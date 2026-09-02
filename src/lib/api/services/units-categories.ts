import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiUnit {
  id: string;
  name: string;
  code: string;
  orderBy: number;
  isActive: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  editBy?: number | null;
  editDate?: string | null;
}

export interface UnitPayload {
  name: string;
  code: string;
  orderBy: number;
  isActive: boolean;
}

export interface ApiCategory {
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

export interface CategoryPayload {
  name: string;
  code: string;
  description: string;
  orderBy: number;
  isActive: boolean;
}

export type UnitsCategoriesSortBy = "name" | "code" | "status" | "createdDate";
export type UnitsCategoriesSortDir = "asc" | "desc";

export interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: UnitsCategoriesSortBy;
  sortDir?: UnitsCategoriesSortDir;
}

const listQuery = (p: ListParams) => ({
  Page: p.page,
  PageSize: p.pageSize,
  Search: p.search ?? "",
  ...(p.sortBy ? { SortBy: p.sortBy } : {}),
  ...(p.sortDir ? { SortDir: p.sortDir } : {}),
});

export const unitsService = {
  list: (params: ListParams) =>
    http.get<ApiEnvelope<PagedResult<ApiUnit>>>("Units", { params: listQuery(params) }),
  get: (id: string) => http.get<ApiEnvelope<ApiUnit>>(`Units/${id}`),
  create: (payload: UnitPayload) => http.post<ApiEnvelope<ApiUnit>>("Units", payload),
  update: (id: string, payload: UnitPayload) =>
    http.put<ApiEnvelope<ApiUnit>>(`Units/${id}`, payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`Units/${id}`),
};

export const categoriesService = {
  list: (params: ListParams) =>
    http.get<ApiEnvelope<PagedResult<ApiCategory>>>("Categories", {
      params: listQuery(params),
    }),
  get: (id: string) => http.get<ApiEnvelope<ApiCategory>>(`Categories/${id}`),
  create: (payload: CategoryPayload) =>
    http.post<ApiEnvelope<ApiCategory>>("Categories", payload),
  update: (id: string, payload: CategoryPayload) =>
    http.put<ApiEnvelope<ApiCategory>>(`Categories/${id}`, payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`Categories/${id}`),
};
