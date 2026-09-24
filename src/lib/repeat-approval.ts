/** Helpers for open repeat-task approval status on Daily / Job UIs. */

export const REPEAT_APPROVAL_PENDING = "PENDING";
export const REPEAT_APPROVAL_REJECTED = "REJECTED";
export const REPEAT_KIND_PACKAGE = "PACKAGE";
export const REPEAT_KIND_ADDON = "ADDON";

export function isRepeatApprovalPending(status?: string | null): boolean {
  return String(status ?? "").toUpperCase() === REPEAT_APPROVAL_PENDING;
}

export function isRepeatApprovalRejected(status?: string | null): boolean {
  return String(status ?? "").toUpperCase() === REPEAT_APPROVAL_REJECTED;
}

export function isRepeatApprovalOpen(status?: string | null): boolean {
  return isRepeatApprovalPending(status) || isRepeatApprovalRejected(status);
}

export function isRepeatPackageKind(kind?: string | null): boolean {
  return String(kind ?? "").toUpperCase() === REPEAT_KIND_PACKAGE;
}
