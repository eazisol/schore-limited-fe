import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiCertificationType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  orderBy: number;
  isActive: boolean;
}

export interface CertificationTypePayload {
  name: string;
  code: string;
  description?: string | null;
  orderBy: number;
  isActive: boolean;
}

export interface CertificationTypeListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

const listQuery = (params: CertificationTypeListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
});

export const certificationTypesService = {
  list: (params: CertificationTypeListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiCertificationType>>>("CertificationTypes", {
      params: listQuery(params),
    }),
  get: (id: string) =>
    http.get<ApiEnvelope<ApiCertificationType>>(`CertificationTypes/${id}`),
  create: (payload: CertificationTypePayload) =>
    http.post<ApiEnvelope<ApiCertificationType>>("CertificationTypes", payload),
  update: (id: string, payload: CertificationTypePayload) =>
    http.put<ApiEnvelope<ApiCertificationType>>(`CertificationTypes/${id}`, payload),
  remove: (id: string) =>
    http.delete<ApiEnvelope<null>>(`CertificationTypes/${id}`),
};
