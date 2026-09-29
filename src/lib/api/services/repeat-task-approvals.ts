import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiRepeatTaskApproval {
  id: string;
  taskId: string;
  taskNumber: string;
  kind: string;
  tradeGroupId: string | null;
  tradeGroupName: string | null;
  productId: string | null;
  productName: string | null;
  itemLabel: string;
  repeatFromTaskItemId: string;
  operativeId: string;
  operativeName: string;
  workDate: string;
  propertyName?: string | null;
  clientName?: string | null;
  rate: number;
  quantity: number;
  timeSlotId: string | null;
  timeSlotName: string | null;
  reason: string;
  statusId: string;
  statusCode: string;
  statusName: string;
  canApprove: boolean;
  requestedBy: string;
  requestedByName: string;
  requestedDate: string;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedDate: string | null;
  reviewReason: string | null;
}

export interface RepeatTaskApprovalListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  statusId?: string;
  requestId?: string;
}

export const REPEAT_TASK_APPROVALS_ROUTE = "/repeat-task-approvals";
export const repeatTaskApprovalsQueryKey = ["repeat-task-approvals"] as const;

export const repeatTaskApprovalsService = {
  list: (params: RepeatTaskApprovalListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiRepeatTaskApproval>>>("RepeatTaskApprovals", {
      params: {
        Page: params.page ?? 1,
        PageSize: params.pageSize ?? 10,
        Search: params.search ?? "",
        ...(params.statusId ? { StatusId: params.statusId } : {}),
        ...(params.requestId ? { RequestId: params.requestId } : {}),
      },
    }),
  approve: (id: string) =>
    http.post<ApiEnvelope<ApiRepeatTaskApproval>>(`RepeatTaskApprovals/${id}/approve`),
  reject: (id: string, reason: string) =>
    http.post<ApiEnvelope<ApiRepeatTaskApproval>>(`RepeatTaskApprovals/${id}/reject`, {
      reason,
    }),
};
