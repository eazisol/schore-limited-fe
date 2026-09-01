import type {
  ApiDashboardActivityPoint,
  DashboardPeriod,
} from "@/lib/api/services/dashboard";

export type ActivityCounts = {
  inProgress: number;
  onHold: number;
  completed: number;
  newTasks: number;
  active: number;
  delayed: number;
};

export type ActivityPoint = {
  label: string;
} & ActivityCounts;

export const ACTIVITY_SERIES = [
  { key: "inProgress", label: "In Progress", color: "var(--info)" },
  { key: "onHold", label: "On Hold", color: "var(--warning)" },
  { key: "completed", label: "Completed", color: "var(--success)" },
  { key: "newTasks", label: "New Jobs", color: "var(--accent)" },
  { key: "active", label: "Active Properties", color: "oklch(0.68 0.11 220)" },
  { key: "delayed", label: "Delayed Properties", color: "var(--destructive)" },
] as const satisfies ReadonlyArray<{
  key: keyof ActivityCounts;
  label: string;
  color: string;
}>;

function parseDay(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { month: "short" });
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function toPoint(point: ApiDashboardActivityPoint, label: string): ActivityPoint {
  return {
    label,
    inProgress: Math.max(0, point.inProgressCount),
    onHold: Math.max(0, point.onHoldCount),
    completed: Math.max(0, point.completedCount),
    newTasks: Math.max(0, point.newTasksCount),
    active: Math.max(0, point.activePropertiesCount),
    delayed: Math.max(0, point.delayedPropertiesCount),
  };
}

function emptyCounts(): Omit<ActivityPoint, "label"> {
  return {
    inProgress: 0,
    onHold: 0,
    completed: 0,
    newTasks: 0,
    active: 0,
    delayed: 0,
  };
}

function monthsInRange(fromIso: string, toIso: string): { key: string; label: string }[] {
  const from = parseDay(fromIso);
  const to = parseDay(toIso);
  const months: { key: string; label: string }[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);

  while (cursor <= to) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: formatMonthLabel(cursor),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function mapYearlyPoints(
  points: ApiDashboardActivityPoint[],
  fromDate?: string,
  toDate?: string,
): ActivityPoint[] {
  const buckets = new Map<string, ApiDashboardActivityPoint[]>();
  for (const point of points) {
    const key = monthKey(point.date);
    const list = buckets.get(key) ?? [];
    list.push(point);
    buckets.set(key, list);
  }

  const rangeStart = fromDate ?? points[0]?.date;
  const rangeEnd = toDate ?? points[points.length - 1]?.date;
  const months =
    rangeStart && rangeEnd
      ? monthsInRange(rangeStart, rangeEnd)
      : [...buckets.keys()].sort().map((key) => ({
          key,
          label: formatMonthLabel(parseDay(`${key}-01`)),
        }));

  return months.map(({ key, label }) => {
    const group = [...(buckets.get(key) ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    if (group.length === 0) return { label, ...emptyCounts() };

    const last = group[group.length - 1]!;
    return {
      label,
      inProgress: Math.max(0, last.inProgressCount),
      onHold: Math.max(0, last.onHoldCount),
      completed: Math.max(0, last.completedCount),
      newTasks: Math.max(0, group.reduce((sum, point) => sum + point.newTasksCount, 0)),
      active: Math.max(0, last.activePropertiesCount),
      delayed: Math.max(0, last.delayedPropertiesCount),
    };
  });
}

/** Maps API history points onto the chart series, with month labels for Yearly. */
export function mapActivityPoints(
  points: ApiDashboardActivityPoint[],
  period?: DashboardPeriod,
  fromDate?: string,
  toDate?: string,
): ActivityPoint[] {
  if (period === "Yearly") {
    return mapYearlyPoints(points, fromDate, toDate);
  }

  return points.map((point) => toPoint(point, formatDayLabel(parseDay(point.date))));
}
