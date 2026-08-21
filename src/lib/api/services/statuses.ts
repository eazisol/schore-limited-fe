import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiStatus {
  id: number;
  name: string;
  code: string;
  documentTypeId?: number | null;
  documentTypeName?: string | null;
  description: string | null;
  orderBy: number;
  isActive: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  editBy?: number | null;
  editDate?: string | null;
}

export interface StatusPayload {
  name: string;
  code: string;
  documentTypeId: number;
  description?: string | null;
  orderBy: number;
  isActive: boolean;
}

export interface StatusListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  documentTypeId?: number;
  /** e.g. TASK | TASK_ITEM */
  documentTypeCode?: string;
}

export const DOCUMENT_TYPE_CODE = {
  TASK: "TASK",
  TASK_ITEM: "TASK_ITEM",
  STATEMENT: "STATEMENT",
  STATEMENT_PAYMENT: "STATEMENT_PAYMENT",
} as const;

const listQuery = (params: StatusListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
  ...(params.documentTypeId != null ? { DocumentTypeId: params.documentTypeId } : {}),
  ...(params.documentTypeCode ? { DocumentTypeCode: params.documentTypeCode } : {}),
});

export const statusesService = {
  list: (params: StatusListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiStatus>>>("Statuses", { params: listQuery(params) }),
  get: (id: number | string) => http.get<ApiEnvelope<ApiStatus>>(`Statuses/${id}`),
  create: (payload: StatusPayload) => http.post<ApiEnvelope<ApiStatus>>("Statuses", payload),
  update: (id: number | string, payload: StatusPayload) =>
    http.put<ApiEnvelope<ApiStatus>>(`Statuses/${id}`, payload),
  remove: (id: number | string) => http.delete<ApiEnvelope<null>>(`Statuses/${id}`),
};
