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

export const usersService = {
  list: () => http.get<ApiEnvelope<ApiUser[]>>("Users"),
  get: (id: number | string) => http.get<ApiEnvelope<ApiUser>>(`Users/${id}`),
  create: (payload: CreateUserPayload) =>
    http.post<ApiEnvelope<ApiUser>>("Users", payload),
  update: (id: number | string, payload: UpdateUserPayload) =>
    http.put<ApiEnvelope<ApiUser>>(`Users/${id}`, payload),
  remove: (id: number | string) =>
    http.delete<ApiEnvelope<null>>(`Users/${id}`),
};
