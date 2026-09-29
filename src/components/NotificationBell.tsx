import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { parseApiDate } from "@/lib/module-ui";
import { resolveNotificationLink } from "@/lib/notification-navigation";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  notificationsQueryKey,
  notificationsService,
  type ApiNotification,
} from "@/lib/api/services/notifications";
import { notifyApiError } from "@/lib/api/axios";

function relativeTime(iso: string) {
  try {
    const d = parseApiDate(iso);
    if (!d) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

export function NotificationBell() {
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
      (await notificationsService.list({ page: 1, pageSize: 20 })).data,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to mark notification read"),
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
      router.history.push(target);
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
          className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-accent-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 ? (
            <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {previewQuery.isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void openNotification(n)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                  !n.isRead && "bg-accent/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-sm", !n.isRead ? "font-semibold" : "font-medium")}>
                    {n.title}
                  </p>
                  {!n.isRead ? (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  ) : null}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                <p className="text-[11px] text-muted-foreground/80">{relativeTime(n.createdDate)}</p>
              </button>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="cursor-pointer justify-center rounded-none py-2.5">
          <Link to="/notifications" className="w-full text-center text-sm font-medium">
            View all
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
