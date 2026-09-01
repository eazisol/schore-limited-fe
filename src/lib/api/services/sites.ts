import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiSite {
  id: number;
  name: string;
  code: string;
  description: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  customerId: number;
  customerName: string | null;
  isActive: boolean;
  createdBy?: number | null;
  createdDate: string;
  editBy?: number | null;
  editDate: string | null;
}

export type SitePayload = {
  name: string;
  code: string;
  description?: string | null;
  address?: string | null;
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  customerId: number;
  isActive: boolean;
};

export interface SiteListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  customerId?: number;
}

const listQuery = (params: SiteListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
  ...(params.customerId != null ? { CustomerId: params.customerId } : {}),
});

function normalizePaged(data: PagedResult<ApiSite> | ApiSite[] | null | undefined): PagedResult<ApiSite> {
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

export const sitesService = {
  list: async (params: SiteListParams = {}) => {
    const res = await http.get<ApiEnvelope<PagedResult<ApiSite> | ApiSite[]>>("Sites", {
      params: listQuery(params),
    });
    return { ...res, data: normalizePaged(res.data) };
  },
  get: (id: number | string) => http.get<ApiEnvelope<ApiSite>>(`Sites/${id}`),
  create: (payload: SitePayload) => http.post<ApiEnvelope<ApiSite>>("Sites", payload),
  update: (id: number | string, payload: SitePayload) =>
    http.put<ApiEnvelope<ApiSite>>(`Sites/${id}`, payload),
  remove: (id: number | string) => http.delete<ApiEnvelope<null>>(`Sites/${id}`),
};
