export type ActivityPoint = {
  label: string;
  active: number;
};

function parseDay(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysInRange(fromIso: string, toIso: string): { date: Date; label: string }[] {
  const from = parseDay(fromIso);
  const to = parseDay(toIso);
  const days: { date: Date; label: string }[] = [];

  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    days.push({ date: new Date(d), label: formatDayLabel(d) });
  }

  if (days.length <= 16) return days;

  const step = Math.ceil(days.length / 14);
  return days.filter((_, i) => i === 0 || i === days.length - 1 || i % step === 0);
}

/** Real API snapshot plotted on each day in range — no invented daily trend. */
export function buildActivityTrend({
  fromDate,
  toDate,
  activeCount,
}: {
  fromDate: string;
  toDate: string;
  activeCount: number;
}): ActivityPoint[] {
  const ticks = daysInRange(fromDate, toDate);
  const active = Math.max(0, activeCount);

  return ticks.map((tick) => ({
    label: tick.label,
    active,
  }));
}
