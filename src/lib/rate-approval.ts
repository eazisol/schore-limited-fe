/** Helpers for over-cap task-line rate approval status on Daily / Job UIs. */

export const RATE_APPROVAL_PENDING = "PENDING";
export const RATE_APPROVAL_REJECTED = "REJECTED";

export function isRateApprovalPending(status?: string | null): boolean {
  return String(status ?? "").toUpperCase() === RATE_APPROVAL_PENDING;
}

export function isRateApprovalRejected(status?: string | null): boolean {
  return String(status ?? "").toUpperCase() === RATE_APPROVAL_REJECTED;
}

export function isRateApprovalOpen(status?: string | null): boolean {
  return isRateApprovalPending(status) || isRateApprovalRejected(status);
}
