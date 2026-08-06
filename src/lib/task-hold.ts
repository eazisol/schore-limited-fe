import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import { HOLD_STATUS_CODE } from "@/lib/hold";

export async function getTaskStatusCode(statusId: string | number): Promise<string | null> {
  const res = await statusesService.list({
    page: 1,
    pageSize: 100,
    documentTypeCode: DOCUMENT_TYPE_CODE.TASK,
  });
  const match = (res.data.items ?? []).find((s) => String(s.id) === String(statusId));
  return match?.code ?? null;
}

export function isHoldStatusCode(code: string | null | undefined): boolean {
  return (code ?? "").toUpperCase() === HOLD_STATUS_CODE;
}

/** True when saving would transition the task onto Hold (needs hold modal). */
export function needsHoldDetails(
  newStatusCode: string | null,
  previousStatusCode?: string | null,
): boolean {
  return isHoldStatusCode(newStatusCode) && !isHoldStatusCode(previousStatusCode);
}
