/** Local YYYY-MM-DD for `<input type="date">`. */
export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Matches backend WeekendCalendar.GetWeekEnding. */
export function getWeekEndingDate(
  date: Date,
  weekendDays: number[],
  weekEndingDay: number,
): Date {
  const weekend = new Set(weekendDays);
  const step = weekend.has(date.getDay()) ? -1 : 1;
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (let i = 0; i < 7; i++) {
    if (cursor.getDay() === weekEndingDay) return cursor;
    cursor.setDate(cursor.getDate() + step);
  }
  return cursor;
}

/** Matches backend WeekendCalendar.GetWeekStart. */
export function getWeekStartDate(
  weekEnding: Date,
  weekendDays: number[],
  weekEndingDay: number,
): Date {
  let cursor = new Date(weekEnding.getFullYear(), weekEnding.getMonth(), weekEnding.getDate());
  while (true) {
    const previous = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
    const previousEnding = getWeekEndingDate(previous, weekendDays, weekEndingDay);
    if (toYmd(previousEnding) !== toYmd(weekEnding)) {
      return cursor;
    }
    cursor = previous;
  }
}

export type CompleteWeekOption = {
  weekEnding: string;
  weekStart: string;
  label: string;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const MONTH_OPTIONS = MONTH_SHORT.map((label, index) => ({
  value: String(index + 1),
  label,
}));

/** e.g. 22 Dec 2025 */
export function formatUkDateMonthText(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  const month = MONTH_SHORT[Number(m) - 1];
  if (!month) return `${d}/${m}/${y}`;
  return `${Number(d)} ${month} ${y}`;
}

/** Readable week range: 22 Dec 2025 – 26 Dec 2025 (or 22 – 26 Dec 2025 when same month/year). */
export function formatWeekRangeMonthText(
  weekStart: string | null | undefined,
  weekEnding: string | null | undefined,
): string {
  if (!weekStart || !weekEnding) return "—";
  const [sy, sm, sd] = weekStart.slice(0, 10).split("-");
  const [ey, em, ed] = weekEnding.slice(0, 10).split("-");
  if (!sy || !sm || !sd || !ey || !em || !ed) {
    return `${formatUkDateMonthText(weekStart)} – ${formatUkDateMonthText(weekEnding)}`;
  }
  const startMonth = MONTH_SHORT[Number(sm) - 1];
  const endMonth = MONTH_SHORT[Number(em) - 1];
  if (!startMonth || !endMonth) {
    return `${formatUkDateMonthText(weekStart)} – ${formatUkDateMonthText(weekEnding)}`;
  }
  if (sy === ey && sm === em) {
    return `${Number(sd)} – ${Number(ed)} ${endMonth} ${ey}`;
  }
  if (sy === ey) {
    return `${Number(sd)} ${startMonth} – ${Number(ed)} ${endMonth} ${ey}`;
  }
  return `${Number(sd)} ${startMonth} ${sy} – ${Number(ed)} ${endMonth} ${ey}`;
}

function toWeekOption(
  weekStart: string,
  weekEnding: string,
): CompleteWeekOption {
  return {
    weekEnding,
    weekStart,
    label: formatWeekRangeMonthText(weekStart, weekEnding),
  };
}

/** Recent complete weeks from holidays weekend / week-ending day config. */
export function buildCompleteWeekOptions(
  weekendDays: number[],
  weekEndingDay: number,
  count = 52,
  fromDate: Date = new Date(),
): CompleteWeekOption[] {
  const options: CompleteWeekOption[] = [];
  let ending = getWeekEndingDate(fromDate, weekendDays, weekEndingDay);
  for (let i = 0; i < count; i++) {
    const start = getWeekStartDate(ending, weekendDays, weekEndingDay);
    options.push(toWeekOption(toYmd(start), toYmd(ending)));
    ending = new Date(ending.getFullYear(), ending.getMonth(), ending.getDate() - 7);
  }
  return options;
}

/**
 * Complete weeks that overlap the given calendar month (1–12),
 * based on holidays weekend / week-ending day.
 */
export function buildWeeksForMonthYear(
  year: number,
  month: number,
  weekendDays: number[],
  weekEndingDay: number,
): CompleteWeekOption[] {
  if (month < 1 || month > 12) return [];
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  let ending = getWeekEndingDate(first, weekendDays, weekEndingDay);
  // Step back so a week ending early in the month (starting prior month) is included.
  ending = new Date(ending.getFullYear(), ending.getMonth(), ending.getDate() - 7);

  const options: CompleteWeekOption[] = [];
  for (let i = 0; i < 10; i++) {
    const start = getWeekStartDate(ending, weekendDays, weekEndingDay);
    if (ending >= first && start <= last) {
      options.push(toWeekOption(toYmd(start), toYmd(ending)));
    }
    if (start > last) break;
    ending = new Date(ending.getFullYear(), ending.getMonth(), ending.getDate() + 7);
  }
  return options.sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
}

/** All complete weeks whose week-ending falls in the given year. */
export function buildWeeksForYear(
  year: number,
  weekendDays: number[],
  weekEndingDay: number,
): CompleteWeekOption[] {
  const options: CompleteWeekOption[] = [];
  for (let month = 12; month >= 1; month--) {
    options.push(...buildWeeksForMonthYear(year, month, weekendDays, weekEndingDay));
  }
  // Dedupe by weekEnding (month boundaries can overlap).
  const seen = new Set<string>();
  return options.filter((w) => {
    if (seen.has(w.weekEnding)) return false;
    seen.add(w.weekEnding);
    return true;
  });
}

export function formatUkDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** Wage sheet style: 16.01.2026 */
export function formatUkDateDots(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

/** Work-completed table date: 21/01 */
export function formatWageSheetDayMonth(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [, m, d] = isoDate.slice(0, 10).split("-");
  if (!m || !d) return isoDate;
  return `${d}/${m}`;
}

/** Wage sheet week range: 16.01 – 23.01.2026 */
export function formatWageWeekRange(
  weekStart: string | null | undefined,
  weekEnding: string | null | undefined,
): string {
  if (!weekStart || !weekEnding) return "—";
  const [sy, sm, sd] = weekStart.slice(0, 10).split("-");
  const [ey, em, ed] = weekEnding.slice(0, 10).split("-");
  if (!sy || !sm || !sd || !ey || !em || !ed) {
    return `${formatUkDateDots(weekStart)} – ${formatUkDateDots(weekEnding)}`;
  }
  return `${sd}.${sm} – ${ed}.${em}.${ey}`;
}

/** Format sequential wage invoice number as WS-0001. */
export function invoiceNo(invoiceNumber: string | number | null | undefined): string {
  const n = typeof invoiceNumber === "number"
    ? invoiceNumber
    : Number.parseInt(String(invoiceNumber ?? "").replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return "WS-————";
  }
  return `WS-${String(n).padStart(4, "0")}`;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? "";
          return /[",\n]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
