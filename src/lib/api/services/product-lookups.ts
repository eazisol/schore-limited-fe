import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

/** Shared lookup row for Categories / Units / ProductTypes dropdowns. */
export interface ApiNamedLookup {
  id: number;
  name: string;
  code?: string | null;
  isActive?: boolean;
}

export interface LookupListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

function listQuery(params: LookupListParams = {}) {
  return {
    Page: params.page ?? 1,
    PageSize: params.pageSize ?? 20,
    Search: params.search ?? "",
  };
}

function normalizePaged(
  data: PagedResult<ApiNamedLookup> | ApiNamedLookup[] | null | undefined,
): PagedResult<ApiNamedLookup> {
  if (Array.isArray(data)) {
    return {
      items: data,
      totalCount: data.length,
      page: 1,
      pageSize: data.length || 20,
      totalPages: 1,
    };
  }
  const items = data?.items ?? [];
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 20;
  const totalCount = data?.totalCount ?? items.length;
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));
  return { items, totalCount, page, pageSize, totalPages };
}

async function listLookup(
  path: string,
  params?: LookupListParams,
): Promise<ApiEnvelope<PagedResult<ApiNamedLookup>>> {
  const res = await http.get<ApiEnvelope<PagedResult<ApiNamedLookup> | ApiNamedLookup[]>>(path, {
    params: listQuery(params),
  });
  return { ...res, data: normalizePaged(res.data) };
}

/**
 * Dropdown-only lookups for the Items module.
 * Do not use these endpoints for CRUD — Categories / Units / ProductTypes APIs only.
 */
export const productLookupsService = {
  categories: (params?: LookupListParams) => listLookup("Categories", params),
  units: (params?: LookupListParams) => listLookup("Units", params),
  productTypes: (params?: LookupListParams) => listLookup("ProductTypes", params),
};
