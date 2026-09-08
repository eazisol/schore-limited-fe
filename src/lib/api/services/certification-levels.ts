import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiCertificationLevel {
  id: string;
  name: string;
  code: string;
  description: string | null;
  certificationTypeId: string;
  certificationTypeName: string;
  orderBy: number;
  isActive: boolean;
}

export interface CertificationLevelPayload {
  name: string;
  code: string;
  description?: string | null;
  certificationTypeId: string;
  orderBy: number;
  isActive: boolean;
}

export interface CertificationLevelListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  certificationTypeId?: string;
}

const listQuery = (params: CertificationLevelListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
  CertificationTypeId: params.certificationTypeId || undefined,
});

export const certificationLevelsService = {
  list: (params: CertificationLevelListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiCertificationLevel>>>("CertificationLevels", {
      params: listQuery(params),
    }),
  get: (id: string) =>
    http.get<ApiEnvelope<ApiCertificationLevel>>(`CertificationLevels/${id}`),
  create: (payload: CertificationLevelPayload) =>
    http.post<ApiEnvelope<ApiCertificationLevel>>("CertificationLevels", payload),
  update: (id: string, payload: CertificationLevelPayload) =>
    http.put<ApiEnvelope<ApiCertificationLevel>>(`CertificationLevels/${id}`, payload),
  remove: (id: string) =>
    http.delete<ApiEnvelope<null>>(`CertificationLevels/${id}`),
};
