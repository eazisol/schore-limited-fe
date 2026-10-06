import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { useDebouncedSearch } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { resolveNotificationLink, navigateToNotificationLink } from "@/lib/notification-navigation";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  notificationsQueryKey,
  notificationsService,
  type ApiNotification,
} from "@/lib/api/services/notifications";
import { notifyApiError } from "@/lib/api/axios";
import { NotificationListRow } from "@/components/notifications/NotificationListRow";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications | Schore" }] }),
  component: NotificationsPage,
});

type InboxTab = "all" | "unread" | "read";

function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { menus } = usePermissions();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tab, setTab] = useState<InboxTab>("all");
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const unreadOnly = tab === "unread";
  const readOnly = tab === "read";

  const query = useQuery({
    queryKey: [
      ...notificationsQueryKey,
      "list",
      { page, pageSize, search, unreadOnly, readOnly },
    ],
    queryFn: async () =>
      (
        await notificationsService.list({
          page,
          pageSize,
          search: search.trim() || undefined,
          unreadOnly: unreadOnly || undefined,
          readOnly: readOnly || undefined,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const unreadCountQuery = useQuery({
    queryKey: [...notificationsQueryKey, "unread-count"],
    queryFn: async () => (await notificationsService.unreadCount()).data,
  });

  const allCountQuery = useQuery({
    queryKey: [...notificationsQueryKey, "meta", "all"],
    queryFn: async () => (await notificationsService.list({ page: 1, pageSize: 1 })).data,
  });

  const readCountQuery = useQuery({
    queryKey: [...notificationsQueryKey, "meta", "read"],
    queryFn: async () =>
      (await notificationsService.list({ page: 1, pageSize: 1, readOnly: true })).data,
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

  const items = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;
  const allCount = allCountQuery.data?.totalCount ?? 0;
  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const readCount = readCountQuery.data?.totalCount ?? 0;

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

  const tabs: { id: InboxTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: allCount },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "read", label: "Read", count: readCount },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markAllMutation.isPending || unreadCount === 0}
            onClick={() => markAllMutation.mutate()}
          >
            {markAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Mark all as read"
            )}
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-start sm:gap-3 sm:px-4">
          <div className="relative min-w-[10rem] w-full sm:w-64 sm:shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search notifications…"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchInput ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => clearSearch()}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div
            className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-border bg-muted p-1"
            role="tablist"
            aria-label="Filter notifications"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] tabular-nums leading-none",
                    tab === t.id
                      ? "bg-accent/15 text-accent"
                      : "bg-background/80 text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No notifications found.</p>
        ) : (
          <>
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationListRow
                    notification={n}
                    onOpen={() => void openNotification(n)}
                  />
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="notifications"
              controlsAlign="center"
              disabled={query.isFetching}
            />
          </>
        )}
      </div>
    </div>
  );
}
