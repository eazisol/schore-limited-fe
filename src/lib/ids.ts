/** Normalize API/route IDs to strings (handles legacy numeric values). */
export function asIdString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value);
}

/** True when value is a non-empty ID string. */
export function isNonEmptyId(value: unknown): value is string {
  return asIdString(value).trim().length > 0;
}
