import { cn } from "@/lib/utils";
import type { ApiNotification } from "@/lib/api/services/notifications";
import { notificationRelativeTime } from "@/lib/notification-ui";
import { NotificationIconBox } from "@/components/notifications/NotificationIconBox";

export function NotificationDropdownRow({
  notification,
  onClick,
}: {
  notification: ApiNotification;
  onClick: () => void;
}) {
  const n = notification;
  const when = notificationRelativeTime(n.createdDate);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/40",
        !n.isRead && "bg-accent/[0.04]",
      )}
    >
      <NotificationIconBox notification={n} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-[13px] leading-snug",
              !n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/90",
            )}
          >
            {n.title}
          </p>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {when ? (
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">{when}</span>
            ) : null}
            {!n.isRead ? (
              <span className="h-1.5 w-1.5 rounded-full bg-info" aria-label="Unread" />
            ) : null}
          </div>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {n.message}
        </p>
      </div>
    </button>
  );
}
