import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiTaskHold {
  id: string;
  taskId: string;
  taskNumber: string | null;
  propertyName: string | null;
  holdDate: string;
  holdReasonId: string;
  holdReasonName: string;
  notes: string | null;
  createdDate?: string | null;
}

export interface CreateTaskHoldPayload {
  taskId: string;
  holdDate: string;
  holdReasonId: string;
  notes?: string | null;
}

export interface TaskHoldListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  taskId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const listQuery = (params: TaskHoldListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
  ...(params.taskId != null ? { TaskId: params.taskId } : {}),
  ...(params.dateFrom ? { DateFrom: params.dateFrom } : {}),
  ...(params.dateTo ? { DateTo: params.dateTo } : {}),
});

export const taskHoldsService = {
  list: (params: TaskHoldListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiTaskHold>>>("TaskHolds", { params: listQuery(params) }),
  get: (id: string) => http.get<ApiEnvelope<ApiTaskHold>>(`TaskHolds/${id}`),
  create: (payload: CreateTaskHoldPayload) =>
    http.post<ApiEnvelope<ApiTaskHold>>("TaskHolds", payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`TaskHolds/${id}`),
};
