import { API_BASE_URL, http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  profileImagePath?: string | null;
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

/** Build absolute URL for a profile image returned by the API. */
export function resolveProfileImageUrl(path: string | null | undefined): string {
  if (!path?.trim()) return "";
  const trimmed = path.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  const origin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function toUserFormData(userData: object, file?: File | null): FormData {
  const formData = new FormData();
  formData.append("UserData", JSON.stringify(userData));
  if (file) formData.append("Files", file);
  return formData;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  isActive: boolean;
  userTypeId: number;
  roleIds: number[];
}

export interface UpdateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  isActive: boolean;
  userTypeId: number;
  roleIds: number[];
}

/** Normalise API date values for `<input type="date">`. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value.trim().slice(0, 10);
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
    http.post<ApiEnvelope<ApiUser>>("Users", toUserFormData(payload)),
  update: (id: number | string, payload: UpdateUserPayload, file?: File | null) =>
    http.put<ApiEnvelope<ApiUser>>(`Users/${id}`, toUserFormData(payload, file)),
  remove: (id: number | string) =>
    http.delete<ApiEnvelope<null>>(`Users/${id}`),
};
