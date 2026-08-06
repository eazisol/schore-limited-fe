import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiHoldReason {
  id: number;
  name: string;
  description: string | null;
  orderBy: number;
  isActive: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  editBy?: number | null;
  editDate?: string | null;
}

export interface HoldReasonPayload {
  name: string;
  description?: string | null;
  orderBy: number;
  isActive: boolean;
}

export interface HoldReasonListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

const listQuery = (params: HoldReasonListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
});

export const holdReasonsService = {
  list: (params: HoldReasonListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiHoldReason>>>("HoldReasons", {
      params: listQuery(params),
    }),
  get: (id: number | string) => http.get<ApiEnvelope<ApiHoldReason>>(`HoldReasons/${id}`),
  create: (payload: HoldReasonPayload) =>
    http.post<ApiEnvelope<ApiHoldReason>>("HoldReasons", payload),
  update: (id: number | string, payload: HoldReasonPayload) =>
    http.put<ApiEnvelope<ApiHoldReason>>(`HoldReasons/${id}`, payload),
  remove: (id: number | string) => http.delete<ApiEnvelope<null>>(`HoldReasons/${id}`),
};
