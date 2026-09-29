import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { useDebouncedSearch } from "@/components/data-table";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalDateTime } from "@/lib/module-ui";
import { resolveNotificationLink } from "@/lib/notification-navigation";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  notificationsQueryKey,
  notificationsService,
  type ApiNotification,
} from "@/lib/api/services/notifications";
import { notifyApiError } from "@/lib/api/axios";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications | Schore" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { menus } = usePermissions();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...notificationsQueryKey, "list", { page, pageSize, search, unreadOnly }],
    queryFn: async () =>
      (
        await notificationsService.list({
          page,
          pageSize,
          search,
          unreadOnly: unreadOnly || undefined,
        })
      ).data,
    placeholderData: keepPreviousData,
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
    <div>
      <PageHeader
        title="Notifications"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markAllMutation.isPending || totalCount === 0}
            onClick={() => markAllMutation.mutate()}
          >
            {markAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Mark all read"
            )}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded border-input"
          />
          Unread only
        </label>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No notifications found.</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(n)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                      !n.isRead && "bg-accent/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className={cn("text-sm", !n.isRead ? "font-semibold" : "font-medium")}>
                        {n.title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatLocalDateTime(n.createdDate)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                  </button>
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
