import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiProperty {
  id: number;
  reference: string | null;
  propertyName: string;
  contactName: string;
  contactPhoneNo: string | null;
  contactEmail: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  accessNotes: string | null;
  customerId: number | null;
  customerName: string | null;
  contractorId: number | null;
  contractorName: string | null;
  isActive: boolean;
  createdBy?: number | null;
  createdDate: string;
  editBy?: number | null;
  editDate: string | null;
}

export type PropertyPayload = {
  reference: string | null;
  propertyName: string;
  contactName: string;
  contactPhoneNo: string | null;
  contactEmail: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  accessNotes: string | null;
  customerId: number | null;
  contractorId: number | null;
  isActive: boolean;
};

export type PropertySortBy =
  | "reference"
  | "name"
  | "customer"
  | "contractor"
  | "contactname"
  | "address"
  | "city"
  | "createdDate";

export type PropertySortDir = "asc" | "desc";

export interface PropertyListParams {
  page: number;
  pageSize: number;
  search?: string;
  customerId?: number;
  contractorId?: number;
  sortBy?: PropertySortBy;
  sortDir?: PropertySortDir;
}

function listQuery(params: PropertyListParams) {
  return {
    Page: params.page,
    PageSize: params.pageSize,
    Search: params.search ?? "",
    ...(params.customerId != null ? { CustomerId: params.customerId } : {}),
    ...(params.contractorId != null ? { ContractorId: params.contractorId } : {}),
    ...(params.sortBy ? { SortBy: params.sortBy } : {}),
    ...(params.sortDir ? { SortDir: params.sortDir } : {}),
  };
}

function normalizePaged(
  data: PagedResult<ApiProperty> | ApiProperty[] | null | undefined,
): PagedResult<ApiProperty> {
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

export const propertiesService = {
  list: async (params: PropertyListParams) => {
    const res = await http.get<ApiEnvelope<PagedResult<ApiProperty> | ApiProperty[]>>("Properties", {
      params: listQuery(params),
    });
    return { ...res, data: normalizePaged(res.data) };
  },
  get: (id: number | string) => http.get<ApiEnvelope<ApiProperty>>(`Properties/${id}`),
  create: (payload: PropertyPayload) =>
    http.post<ApiEnvelope<ApiProperty>>("Properties", payload),
  update: (id: number | string, payload: PropertyPayload) =>
    http.put<ApiEnvelope<ApiProperty>>(`Properties/${id}`, payload),
  remove: (id: number | string) => http.delete<ApiEnvelope<null>>(`Properties/${id}`),
};
