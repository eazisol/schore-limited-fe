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

export function formatUkDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function invoiceNo(id: number): string {
  return `WS-${String(id).padStart(4, "0")}`;
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
