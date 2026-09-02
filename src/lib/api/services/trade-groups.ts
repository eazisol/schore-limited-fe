import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiTradeGroupItem {
  id: string;
  productId: string;
  productName?: string | null;
  productSku?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  quantity: number;
  salePrice?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  orderBy: number;
  notes: string | null;
}

export interface ApiTradeGroup {
  id: string;
  tradeId: string;
  tradeName: string | null;
  name: string;
  code: string;
  description: string | null;
  orderBy: number;
  isActive: boolean;
  items: ApiTradeGroupItem[];
  createdBy?: number | null;
  createdDate: string;
  editBy?: number | null;
  editDate: string | null;
}

export type TradeGroupItemPayload = {
  id: string | null;
  productId: string;
  unitId: string | null;
  quantity: number;
  salePrice: number;
  orderBy: number;
  notes: string | null;
};

export type TradeGroupPayload = {
  tradeId: string;
  name: string;
  code: string;
  description: string;
  orderBy: number;
  isActive: boolean;
  items: TradeGroupItemPayload[];
};

/** Column-driven SortBy values supported by the API. */
export type TradeGroupSortBy = "name" | "code" | "trade" | "status" | "createdDate";
export type TradeGroupSortDir = "asc" | "desc";

export interface TradeGroupListParams {
  page: number;
  pageSize: number;
  search?: string;
  tradeId?: string;
  sortBy?: TradeGroupSortBy;
  sortDir?: TradeGroupSortDir;
}

function listQuery(params: TradeGroupListParams) {
  return {
    Page: params.page,
    PageSize: params.pageSize,
    Search: params.search ?? "",
    ...(params.tradeId != null ? { TradeId: params.tradeId } : {}),
    ...(params.sortBy ? { SortBy: params.sortBy } : {}),
    ...(params.sortDir ? { SortDir: params.sortDir } : {}),
  };
}

function normalizePaged(
  data: PagedResult<ApiTradeGroup> | ApiTradeGroup[] | null | undefined,
): PagedResult<ApiTradeGroup> {
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

export const tradeGroupsService = {
  list: async (params: TradeGroupListParams) => {
    const res = await http.get<ApiEnvelope<PagedResult<ApiTradeGroup> | ApiTradeGroup[]>>(
      "TradeGroups",
      { params: listQuery(params) },
    );
    return { ...res, data: normalizePaged(res.data) };
  },
  get: (id: string) => http.get<ApiEnvelope<ApiTradeGroup>>(`TradeGroups/${id}`),
  create: (payload: TradeGroupPayload) =>
    http.post<ApiEnvelope<ApiTradeGroup>>("TradeGroups", payload),
  update: (id: string, payload: TradeGroupPayload) =>
    http.put<ApiEnvelope<ApiTradeGroup>>(`TradeGroups/${id}`, payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`TradeGroups/${id}`),
};
