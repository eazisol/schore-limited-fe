import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  "In Progress": "bg-info/10 text-info border-info/20",
  "Handed Over": "bg-success/10 text-success border-success/20",
  "On Hold": "bg-warning/15 text-warning-foreground border-warning/30",
  "Snag": "bg-destructive/10 text-destructive border-destructive/20",
  "Draft": "bg-muted text-muted-foreground border-border",
  "Pending": "bg-warning/15 text-warning-foreground border-warning/30",
  "Approved": "bg-info/10 text-info border-info/20",
  "Refused": "bg-destructive/10 text-destructive border-destructive/20",
  "Paid": "bg-success/10 text-success border-success/20",
  "Active": "bg-success/10 text-success border-success/20",
  "Inactive": "bg-muted text-muted-foreground border-border",
  "Ticked": "bg-success/10 text-success border-success/20",
  "Planned": "bg-info/10 text-info border-info/20",
  "Locked": "bg-warning/15 text-warning-foreground border-warning/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border",
      map[status] ?? "bg-muted text-muted-foreground border-border",
      className,
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
