import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiTrade {
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

export type TradePayload = {
  name: string;
  code: string;
  description: string;
  orderBy: number;
  isActive: boolean;
};

export type TradesSortBy = "name" | "code" | "status" | "createdDate";
export type TradesSortDir = "asc" | "desc";

export interface TradesListParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: TradesSortBy;
  sortDir?: TradesSortDir;
}

function listQuery(params: TradesListParams) {
  return {
    Page: params.page,
    PageSize: params.pageSize,
    Search: params.search ?? "",
    ...(params.sortBy ? { SortBy: params.sortBy } : {}),
    ...(params.sortDir ? { SortDir: params.sortDir } : {}),
  };
}

function normalizePaged(
  data: PagedResult<ApiTrade> | ApiTrade[] | null | undefined,
): PagedResult<ApiTrade> {
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
 * Trade Management — OperativesBuilder/trades.
 */
export const tradesService = {
  list: async (params: TradesListParams) => {
    const res = await http.get<ApiEnvelope<PagedResult<ApiTrade> | ApiTrade[]>>(
      "OperativesBuilder/trades",
      { params: listQuery(params) },
    );
    return { ...res, data: normalizePaged(res.data) };
  },
  get: (id: string) =>
    http.get<ApiEnvelope<ApiTrade>>(`OperativesBuilder/trades/${id}`),
  /** Active trades for selects (operatives, etc.). */
  options: async (): Promise<ApiEnvelope<ApiTrade[]>> => {
    const res = await tradesService.list({ page: 1, pageSize: 200, sortBy: "name", sortDir: "asc" });
    return {
      ...res,
      data: (res.data?.items ?? []).filter((t) => t.isActive),
    };
  },
  create: (payload: TradePayload) =>
    http.post<ApiEnvelope<ApiTrade>>("OperativesBuilder/trades", payload),
  update: (id: string, payload: TradePayload) =>
    http.put<ApiEnvelope<ApiTrade>>(`OperativesBuilder/trades/${id}`, payload),
  remove: (id: string) =>
    http.delete<ApiEnvelope<null>>(`OperativesBuilder/trades/${id}`),
};
