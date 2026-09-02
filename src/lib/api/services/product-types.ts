import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiProductType {
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

export interface ProductTypePayload {
  name: string;
  code: string;
  orderBy: number;
  isActive: boolean;
}

export interface ProductTypeListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const productTypesService = {
  list: (params: ProductTypeListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiProductType>>>("ProductTypes", {
      params: {
        Page: params.page ?? 1,
        PageSize: params.pageSize ?? 20,
        Search: params.search ?? "",
      },
    }),
  create: (payload: ProductTypePayload) =>
    http.post<ApiEnvelope<ApiProductType>>("ProductTypes", payload),
};
