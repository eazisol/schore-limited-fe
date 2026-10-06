import { cn } from "@/lib/utils";
import type { ApiNotification } from "@/lib/api/services/notifications";
import { notificationRelativeTime } from "@/lib/notification-ui";
import { NotificationIconBox } from "@/components/notifications/NotificationIconBox";
import { AppTooltip } from "@/components/AppTooltip";

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
        "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors last:border-b-0 sm:gap-4 sm:px-4",
        !n.isRead && "bg-accent/[0.04]",
        "hover:bg-muted/30",
      )}
    >
      <NotificationIconBox notification={n} size="md" className="shrink-0" />

      <AppTooltip
        content={n.title}
        align="start"
        className="w-[14rem] shrink-0 sm:w-[18rem]"
        contentClassName="max-w-xs whitespace-normal font-normal"
      >
        <p
          className={cn(
            "block w-full truncate text-sm leading-snug",
            !n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/90",
          )}
        >
          {n.title}
        </p>
      </AppTooltip>

      <AppTooltip
        content={n.message}
        align="start"
        className="min-w-0 flex-1"
        contentClassName="max-w-sm whitespace-normal font-normal"
      >
        <p className="block w-full truncate text-sm leading-snug text-muted-foreground">
          {n.message}
        </p>
      </AppTooltip>

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
