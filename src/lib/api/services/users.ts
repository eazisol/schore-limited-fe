import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  userTypeId: number;
  userTypeName: string;
  roleIds: number[];
  roleNames: string[];
  createdBy: number | null;
  createdDate: string;
  editBy: number | null;
  editDate: string | null;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  userTypeId: number;
  roleIds: number[];
}

export interface UpdateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  userTypeId: number;
  roleIds: number[];
}

export interface UsersListParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const usersService = {
  list: (params: UsersListParams) =>
    http.get<ApiEnvelope<PagedResult<ApiUser>>>("Users", {
      params: {
        Page: params.page,
        PageSize: params.pageSize,
        Search: params.search ?? "",
      },
    }),
  get: (id: number | string) => http.get<ApiEnvelope<ApiUser>>(`Users/${id}`),
  create: (payload: CreateUserPayload) =>
    http.post<ApiEnvelope<ApiUser>>("Users", payload),
  update: (id: number | string, payload: UpdateUserPayload) =>
    http.put<ApiEnvelope<ApiUser>>(`Users/${id}`, payload),
  remove: (id: number | string) =>
    http.delete<ApiEnvelope<null>>(`Users/${id}`),
};
