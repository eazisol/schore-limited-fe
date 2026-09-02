import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiJobType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  orderBy: number;
  isActive: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  editBy?: number | null;
  editDate?: string | null;
}

export interface JobTypePayload {
  name: string;
  code: string;
  description?: string | null;
  orderBy: number;
  isActive: boolean;
}

export interface JobTypeListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

const listQuery = (params: JobTypeListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
});

export const jobTypesService = {
  list: (params: JobTypeListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiJobType>>>("JobTypes", { params: listQuery(params) }),
  get: (id: string) => http.get<ApiEnvelope<ApiJobType>>(`JobTypes/${id}`),
  create: (payload: JobTypePayload) => http.post<ApiEnvelope<ApiJobType>>("JobTypes", payload),
  update: (id: string, payload: JobTypePayload) =>
    http.put<ApiEnvelope<ApiJobType>>(`JobTypes/${id}`, payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`JobTypes/${id}`),
};
