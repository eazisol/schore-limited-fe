import { cn } from "@/lib/utils";
import type { ApiNotification } from "@/lib/api/services/notifications";
import { notificationRelativeTime } from "@/lib/notification-ui";
import { NotificationIconBox } from "@/components/notifications/NotificationIconBox";

export function NotificationListRow({
  notification,
  onOpen,
}: {
  notification: ApiNotification;
  onOpen: () => void;
}) {
  const n = notification;
  const when = notificationRelativeTime(n.createdDate);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors last:border-b-0 sm:px-4",
        !n.isRead && "bg-accent/[0.04]",
        "hover:bg-muted/30",
      )}
    >
      <NotificationIconBox notification={n} size="md" className="shrink-0" />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            !n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/90",
          )}
        >
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{n.message}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {when ? (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{when}</span>
        ) : null}
        {!n.isRead ? (
          <span className="h-2 w-2 rounded-full bg-info" aria-label="Unread" />
        ) : null}
      </div>
    </button>
  );
}
