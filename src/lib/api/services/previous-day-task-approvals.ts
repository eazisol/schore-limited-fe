import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiPreviousDayTaskApproval {
  id: string;
  taskId: string;
  taskNumber: string;
  taskItemId: string;
  itemLabel: string;
  tradeGroupId: string | null;
  tradeGroupName: string | null;
  productId: string | null;
  productName: string | null;
  operativeId: string | null;
  operativeName: string;
  propertyName: string;
  clientName: string;
  workDate: string;
  rate: number;
  quantity: number;
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

export interface PreviousDayTaskApprovalListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  statusId?: string;
  requestId?: string;
}

export const PREVIOUS_DAY_TASK_APPROVALS_ROUTE = "/previous-day-task-approvals";
export const previousDayTaskApprovalsQueryKey = ["previous-day-task-approvals"] as const;

export const previousDayTaskApprovalsService = {
  list: (params: PreviousDayTaskApprovalListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiPreviousDayTaskApproval>>>("PreviousDayTaskApprovals", {
      params: {
        Page: params.page ?? 1,
        PageSize: params.pageSize ?? 10,
        Search: params.search ?? "",
        ...(params.statusId ? { StatusId: params.statusId } : {}),
        ...(params.requestId ? { RequestId: params.requestId } : {}),
      },
    }),
  approve: (id: string) =>
    http.post<ApiEnvelope<ApiPreviousDayTaskApproval>>(`PreviousDayTaskApprovals/${id}/approve`),
  reject: (id: string, reason: string) =>
    http.post<ApiEnvelope<ApiPreviousDayTaskApproval>>(`PreviousDayTaskApprovals/${id}/reject`, {
      reason,
    }),
};
