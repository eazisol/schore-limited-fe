import type { DashboardPeriod } from "@/lib/api/services/dashboard";

export function toIsoDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday of the week containing `date` (ISO week, matches dashboard calendar). */
export function startOfIsoWeek(date: Date) {
  const next = new Date(date);
  const weekday = next.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + offset);
  return next;
}

export function periodFallbackRange(
  period: DashboardPeriod,
  customFrom: string,
  customTo: string,
  today = new Date(),
) {
  const todayIso = toIsoDay(today);
  if (period === "Daily") return { from: todayIso, to: todayIso };
  if (period === "Weekly") return { from: toIsoDay(startOfIsoWeek(today)), to: todayIso };
  if (period === "Monthly") {
    return {
      from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
      to: todayIso,
    };
  }
  if (period === "Yearly") return { from: `${today.getFullYear()}-01-01`, to: todayIso };
  return { from: customFrom, to: customTo };
}
