import { API_BASE_URL, http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

/**
 * Product entity from the Products API.
 * Items UI consumes this service — swap endpoint later if a dedicated Items API appears.
 */
export interface ApiProduct {
  id: number;
  name: string;
  description: string | null;
  sku: string;
  productTypeId: number;
  productTypeName: string | null;
  categoryId: number;
  categoryName: string | null;
  unitId: number;
  unitName: string | null;
  salePrice: number;
  costPrice: number;
  quantity: number;
  imageUrl: string | null;
  isActive: boolean;
  createdDate?: string | null;
  editDate?: string | null;
}

/** JSON body sent as the `ProductData` FormData field. */
export type ProductPayload = {
  name: string;
  description?: string | null;
  sku: string;
  productTypeId: number;
  categoryId: number;
  unitId: number;
  salePrice: number;
  costPrice: number;
  quantity: number;
  isActive: boolean;
};

export type ProductsSortBy =
  | "name"
  | "sku"
  | "category"
  | "saleprice"
  | "status"
  | "createdDate";
export type ProductsSortDir = "asc" | "desc";

export interface ProductsListParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: ProductsSortBy;
  sortDir?: ProductsSortDir;
}

/** Build absolute URL for a product image returned by the API. */
export function resolveProductImageUrl(
  path: string | null | undefined,
  version?: string | number | null,
): string {
  if (!path?.trim()) return "";
  const trimmed = path.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  const url =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `${API_BASE_URL.replace(/\/api\/?$/, "")}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  if (version == null || version === "") return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(version))}`;
}

function toProductFormData(productData: object, file?: File | null): FormData {
  const formData = new FormData();
  formData.append("ProductData", JSON.stringify(productData));
  if (file) formData.append("Files", file);
  return formData;
}

function listQuery(params: ProductsListParams) {
  return {
    Page: params.page,
    PageSize: params.pageSize,
    Search: params.search ?? "",
    ...(params.sortBy ? { SortBy: params.sortBy } : {}),
    ...(params.sortDir ? { SortDir: params.sortDir } : {}),
  };
}

function normalizePaged(data: PagedResult<ApiProduct> | ApiProduct[] | null | undefined): PagedResult<ApiProduct> {
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
 * Products HTTP service (used by the Items module).
 * Create/update send multipart FormData: ProductData (JSON) + optional Files (image).
 */
export const productsService = {
  list: async (params: ProductsListParams) => {
    const res = await http.get<ApiEnvelope<PagedResult<ApiProduct> | ApiProduct[]>>("Products", {
      params: listQuery(params),
    });
    return {
      ...res,
      data: normalizePaged(res.data),
    };
  },
  get: (id: number | string) => http.get<ApiEnvelope<ApiProduct>>(`Products/${id}`),
  create: (payload: ProductPayload, file?: File | null) =>
    http.post<ApiEnvelope<ApiProduct>>("Products", toProductFormData(payload, file)),
  update: (id: number | string, payload: ProductPayload, file?: File | null) =>
    http.put<ApiEnvelope<ApiProduct>>(`Products/${id}`, toProductFormData(payload, file)),
  removeImage: (id: number | string) =>
    http.delete<ApiEnvelope<null>>(`Products/${id}/image`),
  remove: (id: number | string) => http.delete<ApiEnvelope<null>>(`Products/${id}`),
};
