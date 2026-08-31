import { cn } from "@/lib/utils";
import { STATUS_BADGE_BASE, statusBadgeClassForLabel } from "@/lib/status-colors";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        STATUS_BADGE_BASE,
        statusBadgeClassForLabel(status),
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {status}
    </span>
  );
}

export function ActiveStatusBadge({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  return <StatusBadge status={isActive ? "Active" : "Inactive"} className={className} />;
}
