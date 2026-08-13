import type { ApiDashboardActivityPoint } from "@/lib/api/services/dashboard";

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
  { key: "newTasks", label: "New Tasks", color: "var(--accent)" },
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

/** Maps API daily history points onto the chart series. */
export function mapActivityPoints(points: ApiDashboardActivityPoint[]): ActivityPoint[] {
  return points.map((point) => ({
    label: formatDayLabel(parseDay(point.date)),
    inProgress: Math.max(0, point.inProgressCount),
    onHold: Math.max(0, point.onHoldCount),
    completed: Math.max(0, point.completedCount),
    newTasks: Math.max(0, point.newTasksCount),
    active: Math.max(0, point.activePropertiesCount),
    delayed: Math.max(0, point.delayedPropertiesCount),
  }));
}
