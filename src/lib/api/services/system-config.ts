import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiRole {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

export interface ApiUserType {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
}

export interface RolePayload {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
}

export interface UserTypePayload {
  name: string;
  code: string;
  isActive: boolean;
}

export type SystemConfigSortBy = "name" | "code" | "status" | "createdDate";
export type SystemConfigSortDir = "asc" | "desc";

export interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: SystemConfigSortBy;
  sortDir?: SystemConfigSortDir;
}

const listQuery = (p: ListParams) => ({
  Page: p.page,
  PageSize: p.pageSize,
  Search: p.search ?? "",
  ...(p.sortBy ? { SortBy: p.sortBy } : {}),
  ...(p.sortDir ? { SortDir: p.sortDir } : {}),
});

export const rolesService = {
  list: (params: ListParams) =>
    http.get<ApiEnvelope<PagedResult<ApiRole>>>("Roles", { params: listQuery(params) }),
  get: (id: number | string) => http.get<ApiEnvelope<ApiRole>>(`Roles/${id}`),
  create: (payload: RolePayload) => http.post<ApiEnvelope<ApiRole>>("Roles", payload),
  update: (id: number | string, payload: RolePayload) =>
    http.put<ApiEnvelope<ApiRole>>(`Roles/${id}`, payload),
  remove: (id: number | string) => http.delete<ApiEnvelope<null>>(`Roles/${id}`),
};

export const userTypesService = {
  list: (params: ListParams) =>
    http.get<ApiEnvelope<PagedResult<ApiUserType>>>("UserTypes", { params: listQuery(params) }),
  get: (id: number | string) => http.get<ApiEnvelope<ApiUserType>>(`UserTypes/${id}`),
  create: (payload: UserTypePayload) =>
    http.post<ApiEnvelope<ApiUserType>>("UserTypes", payload),
  update: (id: number | string, payload: UserTypePayload) =>
    http.put<ApiEnvelope<ApiUserType>>(`UserTypes/${id}`, payload),
  remove: (id: number | string) => http.delete<ApiEnvelope<null>>(`UserTypes/${id}`),
};
