import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CalendarClock,
  History,
  Loader2,
  Package,
  PackageMinus,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { tasksService, type ApiTaskTimelineEntry } from "@/lib/api/services/tasks";
import { formatDateTime } from "@/lib/module-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ACTION_LABELS: Record<string, string> = {
  Created: "Job created",
  Updated: "Job updated",
  Deleted: "Job deleted",
  ItemAdded: "Item added",
  ItemUpdated: "Item updated",
  ItemCompleted: "Item completed",
  ItemRemoved: "Item removed",
  RateSubmitted: "Rate submitted for approval",
  RateApproved: "Rate approved",
  RateRejected: "Rate rejected",
  RateResubmitted: "Rate resubmitted for approval",
};

type Props = {
  taskId: string;
  className?: string;
  /** When false, skips the fetch (e.g. drawer closed). */
  enabled?: boolean;
  variant?: "panel" | "drawer";
};

export function TaskTimelinePanel({
  taskId,
  className,
  enabled = true,
  variant = "panel",
}: Props) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["tasks", taskId, "timeline"],
    queryFn: async () => (await tasksService.getTimeline(taskId)).data,
    enabled: Boolean(taskId) && enabled,
  });

  const isDrawer = variant === "drawer";
  const groups = useMemo(() => (data?.length ? groupByDay(data) : []), [data]);

  return (
    <section
      className={cn(
        isDrawer ? "flex min-h-0 flex-1 flex-col" : "card-elevated space-y-3 px-4 py-3",
        className,
      )}
    >
      {!isDrawer ? (
        <div>
          <h2 className="text-sm font-semibold">Timeline</h2>
          <p className="text-xs text-muted-foreground">Activity history for this job</p>
        </div>
      ) : null}

      {isLoading ? (
        <div
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground",
            isDrawer && "justify-center py-16",
          )}
        >
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Loading timeline…
        </div>
      ) : isError ? (
        <div className={cn("space-y-2", isDrawer && "py-10 text-center")}>
          <p className="text-sm text-destructive">Failed to load timeline.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : !data?.length ? (
        <div
          className={cn(
            "text-sm text-muted-foreground",
            isDrawer && "flex flex-col items-center justify-center gap-2 py-16 text-center",
          )}
        >
          {isDrawer ? (
            <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
              <History className="h-5 w-5" />
            </span>
          ) : null}
          <p>No activity yet.</p>
        </div>
      ) : isDrawer ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {isFetching && !isLoading ? (
            <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Refreshing…
            </p>
          ) : null}
          <div className="space-y-6">
            {groups.map((group) => (
              <ActivityDayGroup key={group.key} group={group} />
            ))}
          </div>
        </div>
      ) : (
        <ol className="relative space-y-0 border-l border-border/70 pl-4">
          {data.map((entry) => (
            <PanelTimelineRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  );
}

type DayGroup = {
  key: string;
  label: string;
  entries: ApiTaskTimelineEntry[];
};

function ActivityDayGroup({ group }: { group: DayGroup }) {
  return (
    <section className="relative">
      <div className="mb-4 grid grid-cols-[3.25rem_1rem_minmax(0,1fr)] items-center gap-x-2">
        <span aria-hidden className="block" />
        <span className="mx-auto h-2 w-2 rounded-full bg-[#8a9a4a]" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/80">
          {group.label}
        </h3>
      </div>

      <ol className="relative">
        {/* continuous rail under the date marker */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-2 left-[calc(3.25rem+0.5rem+0.5rem-0.5px)] top-0 w-px bg-border/80"
        />
        {group.entries.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} />
        ))}
      </ol>
    </section>
  );
}

function ActivityRow({ entry }: { entry: ApiTaskTimelineEntry }) {
  const meta = actionVisual(entry.action);
  const Icon = meta.Icon;
  const actor = entry.actorName?.trim() || "System";
  const detail = activityDetail(entry);

  return (
    <li className="relative grid grid-cols-[3.25rem_1rem_minmax(0,1fr)] gap-x-2 pb-5 last:pb-1">
      <time className="pt-2 text-right text-[11px] tabular-nums leading-none text-muted-foreground">
        {formatTime(entry.createdDate)}
      </time>

      <div className="relative flex justify-center pt-[0.55rem]">
        <span className="relative z-[1] h-2 w-2 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
      </div>

      <div className="flex min-w-0 gap-2.5">
        <span
          className={cn(
            "inline-grid h-8 w-8 shrink-0 place-items-center rounded-md",
            meta.iconWrap,
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[13px] leading-snug text-foreground">
            {meta.phrase} by <span className="font-semibold">{actor}</span>
          </p>
          {detail ? (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{detail}</p>
          ) : null}
          {entry.reason?.trim() ? (
            <p className="mt-0.5 text-xs font-bold leading-snug text-foreground">
              {entry.reason.trim()}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function PanelTimelineRow({ entry }: { entry: ApiTaskTimelineEntry }) {
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
        {entry.reason?.trim() ? (
          <p className="mt-1 text-xs font-bold leading-snug text-foreground">
            {entry.reason.trim()}
          </p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          by {entry.actorName || "System"}
        </p>
      </div>
    </li>
  );
}

function actionVisual(action: string): {
  phrase: string;
  Icon: LucideIcon;
  iconWrap: string;
} {
  switch (action) {
    case "Created":
      return {
        phrase: "Job created",
        Icon: Plus,
        iconWrap: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      };
    case "Updated":
      return {
        phrase: "Job updated",
        Icon: Pencil,
        iconWrap: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
      };
    case "Deleted":
      return {
        phrase: "Job deleted",
        Icon: Trash2,
        iconWrap: "bg-destructive/10 text-destructive",
      };
    case "ItemAdded":
      return {
        phrase: "Product added",
        Icon: Package,
        iconWrap: "bg-amber-700/10 text-amber-800 dark:text-amber-400",
      };
    case "ItemUpdated":
      return {
        phrase: "Item updated",
        Icon: Tag,
        iconWrap: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
      };
    case "ItemCompleted":
      return {
        phrase: "Item completed",
        Icon: BadgeCheck,
        iconWrap: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      };
    case "ItemRemoved":
      return {
        phrase: "Item removed",
        Icon: PackageMinus,
        iconWrap: "bg-stone-500/10 text-stone-600 dark:text-stone-300",
      };
    case "RateSubmitted":
      return {
        phrase: "Rate submitted for approval",
        Icon: Send,
        iconWrap: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      };
    case "RateResubmitted":
      return {
        phrase: "Rate resubmitted for approval",
        Icon: RefreshCw,
        iconWrap: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      };
    case "RateApproved":
      return {
        phrase: "Rate approved",
        Icon: BadgeCheck,
        iconWrap: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      };
    case "RateRejected":
      return {
        phrase: "Rate rejected",
        Icon: XCircle,
        iconWrap: "bg-destructive/10 text-destructive",
      };
    default:
      return {
        phrase: ACTION_LABELS[action] ?? action,
        Icon: CalendarClock,
        iconWrap: "bg-accent/10 text-accent",
      };
  }
}

function activityDetail(entry: ApiTaskTimelineEntry): string | null {
  const bits: string[] = [];

  if (entry.previousStatus || entry.newStatus) {
    bits.push(`${entry.previousStatus || "—"} → ${entry.newStatus || "—"}`);
  }

  if (entry.previousRate != null || entry.newRate != null) {
    bits.push(`Rate ${formatMoney(entry.previousRate)} → ${formatMoney(entry.newRate)}`);
  }

  if (entry.itemLabel?.trim()) {
    const label = entry.itemLabel.trim();
    if (entry.action === "ItemAdded") bits.push(`Added: ${label}`);
    else if (entry.action === "ItemCompleted") bits.push(`Completed: ${label}`);
    else if (entry.action === "ItemRemoved") bits.push(`Removed: ${label}`);
    else if (!bits.some((b) => b.includes(label))) bits.push(label);
  }

  if (entry.workDate) {
    bits.push(entry.workDate.slice(0, 10));
  }

  if (entry.summary?.trim() && entry.summary.trim() !== ACTION_LABELS[entry.action]) {
    const summary = entry.summary.trim();
    if (!bits.includes(summary)) bits.push(summary);
  }

  return bits.length ? bits.join(" · ") : null;
}

function groupByDay(entries: ApiTaskTimelineEntry[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const entry of entries) {
    const key = dayKey(entry.createdDate);
    const existing = map.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      map.set(key, {
        key,
        label: formatDayHeader(entry.createdDate),
        entries: [entry],
      });
    }
  }
  return Array.from(map.values());
}

function dayKey(value: string): string {
  const d = parseDate(value);
  if (!d) return value.slice(0, 10) || "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(value: string): string {
  const d = parseDate(value);
  if (!d) return value.slice(0, 10) || "—";
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

function formatTime(value: string): string {
  const d = parseDate(value);
  if (!d) {
    const raw = value.replace("T", " ").slice(11, 16);
    return raw || "—";
  }
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
