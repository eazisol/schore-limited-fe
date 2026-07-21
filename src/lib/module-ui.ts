/** Shared Active/Inactive pill styles used across module tables. */
export function activeStatusClass(isActive: boolean): string {
  return isActive
    ? "border-success/20 bg-success/10 text-success"
    : "border-destructive/20 bg-destructive/10 text-destructive";
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

export function formatCisRate(rate: number): string {
  return `${rate}%`;
}
