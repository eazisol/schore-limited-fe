/** Shared semantic tones used by badges, dashboard counts, and charts. */
export type StatusTone = "success" | "info" | "warning" | "destructive" | "muted" | "accent";

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success/10 text-success border-success/20",
  info: "bg-info/10 text-info border-info/20",
  warning: "bg-warning/10 text-warning-foreground border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  muted: "bg-muted text-muted-foreground border-border",
  accent: "bg-accent/15 text-accent border-accent/20",
};

export const STATUS_BADGE_BASE =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 py-0.5 text-[11px] font-medium rounded-full border";

const STATUS_TONE_BY_LABEL: Record<string, StatusTone> = {
  // Property / task workflow
  "In Progress": "info",
  "Handed Over": "success",
  Completed: "success",
  "On Hold": "warning",
  Snag: "destructive",
  Delayed: "destructive",

  // Wage / payment workflow
  Draft: "muted",
  Sent: "warning",
  Pending: "warning",
  Accepted: "info",
  Approved: "info",
  Refused: "destructive",
  Rejected: "destructive",
  "Not Applicable": "muted",
  Unpaid: "muted",
  Paid: "success",

  // Entity availability
  Active: "success",
  Inactive: "destructive",

  // Task flags
  Ticked: "success",
  Planned: "info",
  Locked: "warning",
};

const STATUS_TONE_BY_CODE: Record<string, StatusTone> = {
  IN_PROGRESS: "info",
  HANDED_OVER: "success",
  COMPLETED: "success",
  ON_HOLD: "warning",
  SNAG: "destructive",
  DELAYED: "destructive",
  DRAFT: "muted",
  SENT: "warning",
  PENDING: "warning",
  ACCEPTED: "info",
  APPROVED: "info",
  REFUSED: "destructive",
  REJECTED: "destructive",
  NOT_APPLICABLE: "muted",
  UNPAID: "muted",
  PAID: "success",
  ACTIVE: "success",
  INACTIVE: "destructive",
  TICKED: "success",
  PLANNED: "info",
  LOCKED: "warning",
};

export function statusToneForLabel(status: string): StatusTone {
  const trimmed = status.trim();
  if (!trimmed) return "muted";

  const byLabel = STATUS_TONE_BY_LABEL[trimmed];
  if (byLabel) return byLabel;

  const byCode = STATUS_TONE_BY_CODE[trimmed.toUpperCase().replace(/\s+/g, "_")];
  if (byCode) return byCode;

  return "muted";
}

export function statusBadgeClassForLabel(status: string): string {
  return STATUS_TONE_CLASSES[statusToneForLabel(status)];
}

/** Active/Inactive pill styles used across module tables. */
export function activeStatusClass(isActive: boolean): string {
  return STATUS_TONE_CLASSES[isActive ? "success" : "destructive"];
}
