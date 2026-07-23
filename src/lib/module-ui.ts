/** Shared Active/Inactive pill styles used across module tables. */
export function activeStatusClass(isActive: boolean): string {
  return isActive
    ? "whitespace-nowrap border-success/20 bg-success/10 text-success"
    : "whitespace-nowrap border-destructive/20 bg-destructive/10 text-destructive";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

export function formatGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Currency with up to 2 decimal places (e.g. operative daily rate). */
export function formatDailyRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatCisRate(rate: number): string {
  return `${rate}%`;
}

/** Truncate display text for table name cells; full value stays available via tooltip. */
export function truncateWithEllipsis(value: string, maxChars = 30): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
}
