import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiRole {
  id: number;
  name: string;
  code: string;
  description: string | null;
  orderBy: number;
  isActive: boolean;
}

export interface ApiUserType {
  id: number;
  name: string;
  code: string;
  orderBy: number;
  isActive: boolean;
}

/**
 * The API returns `Roles` and `UserTypes` as paginated envelopes
 * (`{ items, totalCount, page, pageSize, totalPages }`). We fetch a large
 * page and expose an unwrapped array to callers, keeping the envelope shape
 * (`{ success, message, data }`) so existing consumers keep working.
 */
async function fetchAll<T>(url: string): Promise<ApiEnvelope<T[]>> {
  const res = await http.get<ApiEnvelope<PagedResult<T>>>(url, {
    params: { Page: 1, PageSize: 500 },
  });
  return {
    success: res.success,
    message: res.message,
    data: res.data?.items ?? [],
  };
}

export const lookupsService = {
  roles: () => fetchAll<ApiRole>("Roles"),
  userTypes: () => fetchAll<ApiUserType>("UserTypes"),
};
