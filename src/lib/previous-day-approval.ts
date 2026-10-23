/** Helpers for previous-day task-line approval status on Daily / Job UIs. */

import { toYmd } from "@/lib/week-ending";
import { isBlankTaskItem, type TaskItemFormValues } from "@/lib/task-form";

export const PREVIOUS_DAY_APPROVAL_PENDING = "PENDING";
export const PREVIOUS_DAY_APPROVAL_REJECTED = "REJECTED";

export function isPreviousDayApprovalPending(status?: string | null): boolean {
  return String(status ?? "").toUpperCase() === PREVIOUS_DAY_APPROVAL_PENDING;
}

export function isPreviousDayApprovalRejected(status?: string | null): boolean {
  return String(status ?? "").toUpperCase() === PREVIOUS_DAY_APPROVAL_REJECTED;
}

export function isPreviousDayApprovalOpen(status?: string | null): boolean {
  return isPreviousDayApprovalPending(status) || isPreviousDayApprovalRejected(status);
}

/** New lines (no id) dated before today that still need a previous-day reason. */
export function indexesNeedingPreviousDayReason(
  items: TaskItemFormValues[] | undefined | null,
  todayYmd: string = toYmd(new Date()),
): number[] {
  const rows = items ?? [];
  const indexes: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    if (!item || isBlankTaskItem(item)) continue;
    if (String(item.id ?? "").trim()) continue;
    const workDate = String(item.workDate ?? "").trim();
    if (!workDate || workDate >= todayYmd) continue;
    if (String(item.previousDayReason ?? "").trim()) continue;
    indexes.push(i);
  }
  return indexes;
}

/**
 * Call from a job save path before `toTaskPayload` / mutate.
 * Returns indexes that still need a reason — open a modal, set `previousDayReason`, then retry.
 */
export function ensurePreviousDayReasons(
  items: TaskItemFormValues[] | undefined | null,
  todayYmd?: string,
): { ok: true } | { ok: false; indexes: number[] } {
  const indexes = indexesNeedingPreviousDayReason(items, todayYmd);
  return indexes.length === 0 ? { ok: true } : { ok: false, indexes };
}
