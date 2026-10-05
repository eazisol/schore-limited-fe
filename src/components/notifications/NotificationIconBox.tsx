import { cn } from "@/lib/utils";
import type { ApiNotification } from "@/lib/api/services/notifications";
import { notificationIconBoxClass, notificationVisual } from "@/lib/notification-ui";
export function NotificationIconBox({
  notification,
  size = "md",
  className,
}: {
  notification: ApiNotification;
  size?: "sm" | "md";
  className?: string;
}) {
  const { tone, Icon } = notificationVisual(notification);
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border",
        dim,
        notificationIconBoxClass(tone),
        className,
      )}
    >
      <Icon className={iconDim} strokeWidth={1.75} aria-hidden />
    </div>
  );
}
