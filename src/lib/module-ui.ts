export { activeStatusClass } from "@/lib/status-colors";

/**
 * Parse API timestamps. Values without a timezone are treated as UTC
 * (backend stores DateTime.UtcNow).
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized =
    !hasTimezone && trimmed.includes("T")
      ? `${trimmed.replace(/\.\d{1,7}$/, "")}Z`
      : trimmed;

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Display API datetime in the browser's local timezone (YYYY-MM-DD HH:mm). */
export function formatLocalDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parseApiDate(value);
  if (!d) return value.replace("T", " ").slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

/** Multi-line address for detail views — street, then city/state/country/zip on following lines. */
export function formatDetailAddress(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
}): string {
  const lines: string[] = [];
  if (parts.address?.trim()) lines.push(parts.address.trim());
  const cityLine = [parts.city, parts.state]
    .filter((s) => s?.trim())
    .map((s) => s!.trim())
    .join(", ");
  const countryZip = [parts.country?.trim(), parts.zipCode?.trim()].filter(Boolean).join(" ");
  const line2 = [cityLine, countryZip].filter(Boolean).join(", ");
  if (line2) lines.push(line2);
  return lines.length ? lines.join("\n") : "—";
}

/** Single-line location for hero subtitles. */
export function formatLocationLine(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
}): string | undefined {
  const line = [
    parts.address,
    parts.city,
    parts.state,
    parts.country,
    parts.zipCode,
  ]
    .filter((s) => s?.trim())
    .map((s) => s!.trim())
    .join(", ");
  return line || undefined;
}

/** True when two display names likely refer to the same person/company (e.g. "Gary paker" vs "Gary Parker"). */
export function namesLookSimilar(a: string, b: string): boolean {
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ");
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftParts = left.split(" ");
  const rightParts = right.split(" ");
  if (leftParts[0] && leftParts[0] === rightParts[0] && leftParts.length <= 2 && rightParts.length <= 2) {
    return true;
  }
  return false;
}

/** Truncate display text for table name cells; full value stays available via tooltip. */
export function truncateWithEllipsis(value: string, maxChars = 30): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
}
