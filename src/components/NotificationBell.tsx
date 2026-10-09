import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, Loader2, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { resolveNotificationLink, navigateToNotificationLink } from "@/lib/notification-navigation";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  notificationsQueryKey,
  notificationsService,
  type ApiNotification,
} from "@/lib/api/services/notifications";
import { notifyApiError } from "@/lib/api/axios";
import { NotificationDropdownRow } from "@/components/notifications/NotificationDropdownRow";

/** Set true to restore notification dropdown + unread count. */
const NOTIFICATIONS_CLICKABLE = false;

export function NotificationBell() {
  // Temporarily non-clickable (no count, no dropdown) — flip flag above when needed.
  if (!NOTIFICATIONS_CLICKABLE) {
    return (
      <span
        className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {/* Unread count badge — temporarily disabled
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-accent-foreground ring-2 ring-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
        */}
      </span>
    );
  }

  return <NotificationBellActive />;
}

function NotificationBellActive() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { menus } = usePermissions();

  const unreadQuery = useQuery({
    queryKey: [...notificationsQueryKey, "unread-count"],
    queryFn: async () => (await notificationsService.unreadCount()).data,
    refetchInterval: 60_000,
  });

  const previewQuery = useQuery({
    queryKey: [...notificationsQueryKey, "preview"],
    queryFn: async () =>
      (await notificationsService.list({ page: 1, pageSize: 8 })).data,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to mark notification read"),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to mark all read"),
  });

  const unreadCount = unreadQuery.data?.count ?? 0;
  const items = previewQuery.data?.items ?? [];

  async function openNotification(n: ApiNotification) {
    const target = n.linkPath ? resolveNotificationLink(menus, n.linkPath) : null;
    if (n.linkPath && !target) {
      return;
    }

    if (!n.isRead) {
      try {
        await markReadMutation.mutateAsync(n.id);
      } catch {
        // still navigate when possible
      }
    }
    if (target) {
      navigateToNotificationLink((opts) => router.navigate(opts), target);
    }
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          void previewQuery.refetch();
          void unreadQuery.refetch();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-accent-foreground ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-2rem,22rem)] overflow-hidden p-0 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <h2 className="font-display text-sm font-semibold tracking-tight">Notifications</h2>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-medium text-info hover:text-info"
              disabled={markAllMutation.isPending || unreadCount === 0}
              onClick={() => markAllMutation.mutate()}
            >
              {markAllMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Mark all as read"
              )}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to="/profile" aria-label="Notification settings">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="max-h-[min(18rem,48vh)] overflow-y-auto">
          {previewQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            items.map((n) => (
              <NotificationDropdownRow
                key={n.id}
                notification={n}
                onClick={() => void openNotification(n)}
              />
            ))
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button variant="outline" size="sm" className="h-9 w-full gap-1 text-xs font-medium" asChild>
            <Link to="/notifications">
              View all notifications
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
