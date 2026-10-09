/** Shared off-day checks (weekend settings + active holidays). */

export const OFF_DAY_ASSIGN_MESSAGE =
  "Cannot assign tasks on an off day (weekend or holiday).";

/** `weekendDays` uses JS getDay() values: 0 = Sunday … 6 = Saturday. */
export function isOffDayDate(
  date: Date,
  weekendDays: ReadonlySet<number> | undefined,
  holidayYmds: ReadonlySet<string> | undefined,
): boolean {
  if (weekendDays?.has(date.getDay())) return true;
  if (!holidayYmds || holidayYmds.size === 0) return false;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return holidayYmds.has(`${y}-${m}-${d}`);
}

export function isOffDayYmd(
  ymd: string,
  weekendDays: ReadonlySet<number> | undefined,
  holidayYmds: ReadonlySet<string> | undefined,
): boolean {
  if (!ymd || ymd.length < 10) return false;
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return false;
  return isOffDayDate(new Date(y, m - 1, d), weekendDays, holidayYmds);
}
