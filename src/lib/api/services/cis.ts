import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiCisStatus {
  id: string;
  name: string;
  code: string;
  rate: number;
  description: string | null;
  orderBy: number;
  isActive: boolean;
  /** Optional — may be absent from OperativesBuilder/cis responses. */
  isDefault?: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  editBy?: number | null;
  editDate?: string | null;
}

export type CisStatusPayload = {
  name: string;
  code: string;
  rate: number;
  description: string;
  orderBy: number;
  isActive: boolean;
};

export type CisSortBy = "name" | "code" | "rate" | "status" | "createdDate";
export type CisSortDir = "asc" | "desc";

export interface CisListParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: CisSortBy;
  sortDir?: CisSortDir;
}

function listQuery(params: CisListParams) {
  return {
    Page: params.page,
    PageSize: params.pageSize,
    Search: params.search ?? "",
    ...(params.sortBy ? { SortBy: params.sortBy } : {}),
    ...(params.sortDir ? { SortDir: params.sortDir } : {}),
  };
}

function normalizePaged(
  data: PagedResult<ApiCisStatus> | ApiCisStatus[] | null | undefined,
): PagedResult<ApiCisStatus> {
  if (Array.isArray(data)) {
    return {
      items: data,
      totalCount: data.length,
      page: 1,
      pageSize: data.length || 10,
      totalPages: 1,
    };
  }
  const items = data?.items ?? [];
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 10;
  const totalCount = data?.totalCount ?? items.length;
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));
  return { items, totalCount, page, pageSize, totalPages };
}

/**
 * CIS Management — OperativesBuilder/cis.
 */
export const cisService = {
  list: async (params: CisListParams) => {
    const res = await http.get<ApiEnvelope<PagedResult<ApiCisStatus> | ApiCisStatus[]>>(
      "OperativesBuilder/cis",
      { params: listQuery(params) },
    );
    return { ...res, data: normalizePaged(res.data) };
  },
  get: (id: string) =>
    http.get<ApiEnvelope<ApiCisStatus>>(`OperativesBuilder/cis/${id}`),
  /** Active CIS statuses for selects (operatives, etc.). */
  options: async (): Promise<ApiEnvelope<ApiCisStatus[]>> => {
    const res = await cisService.list({ page: 1, pageSize: 200, sortBy: "rate", sortDir: "asc" });
    return {
      ...res,
      data: (res.data?.items ?? []).filter((c) => c.isActive),
    };
  },
  create: (payload: CisStatusPayload) =>
    http.post<ApiEnvelope<ApiCisStatus>>("OperativesBuilder/cis", payload),
  update: (id: string, payload: CisStatusPayload) =>
    http.put<ApiEnvelope<ApiCisStatus>>(`OperativesBuilder/cis/${id}`, payload),
  remove: (id: string) =>
    http.delete<ApiEnvelope<null>>(`OperativesBuilder/cis/${id}`),
};
