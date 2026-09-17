import { useQuery } from "@tanstack/react-query";
import { tasksService, type ApiTaskTimelineEntry } from "@/lib/api/services/tasks";
import { formatDateTime } from "@/lib/module-ui";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  Created: "Job created",
  Updated: "Job updated",
  Deleted: "Job deleted",
  ItemAdded: "Item added",
  ItemUpdated: "Item updated",
  ItemRemoved: "Item removed",
};

type Props = {
  taskId: string;
  className?: string;
};

export function TaskTimelinePanel({ taskId, className }: Props) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks", taskId, "timeline"],
    queryFn: async () => (await tasksService.getTimeline(taskId)).data,
  });

  return (
    <section className={cn("card-elevated space-y-3 px-4 py-3", className)}>
      <div>
        <h2 className="text-sm font-semibold">Timeline</h2>
        <p className="text-xs text-muted-foreground">Activity history for this job</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading timeline…</p>
      ) : isError ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">Failed to load timeline.</p>
          <button
            type="button"
            className="text-xs font-medium text-accent underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="relative space-y-0 border-l border-border/70 pl-4">
          {data.map((entry) => (
            <TimelineRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TimelineRow({ entry }: { entry: ApiTaskTimelineEntry }) {
  const title = ACTION_LABELS[entry.action] ?? entry.action;
  const hasRateChange = entry.previousRate != null || entry.newRate != null;
  const hasStatusChange = Boolean(entry.previousStatus || entry.newStatus);

  return (
    <li className="relative pb-4 last:pb-0">
      <span className="absolute -left-[1.15rem] top-1.5 h-2 w-2 rounded-full bg-accent" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatDateTime(entry.createdDate)}
          </span>
        </div>
        {entry.itemLabel ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.itemLabel}
            {entry.workDate ? ` · ${entry.workDate.slice(0, 10)}` : ""}
          </p>
        ) : null}
        {entry.summary && entry.summary !== ACTION_LABELS[entry.action] ? (
          <p className="mt-0.5 text-xs text-foreground/80">{entry.summary}</p>
        ) : null}
        {hasRateChange ? (
          <p className="mt-0.5 text-xs text-foreground/80">
            <span className="font-medium text-muted-foreground">Rate: </span>
            {formatMoney(entry.previousRate)} → {formatMoney(entry.newRate)}
          </p>
        ) : null}
        {hasStatusChange ? (
          <p className="mt-0.5 text-xs text-foreground/80">
            <span className="font-medium text-muted-foreground">Status: </span>
            {entry.previousStatus || "—"} → {entry.newStatus || "—"}
          </p>
        ) : null}
        {entry.reason ? (
          <p className="mt-1 rounded-md border bg-muted/30 px-2 py-1 text-xs">
            <span className="font-medium text-muted-foreground">Reason: </span>
            {entry.reason}
          </p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-muted-foreground">by {entry.actorName || "System"}</p>
      </div>
    </li>
  );
}

function formatMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
