import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiProject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  siteId: string;
  siteName: string | null;
  customerId: string;
  customerName: string | null;
  assignedUsers?: { id: string; name: string }[];
  rateOverrides?: { id: string; productId: string; productName: string; rate: number; effectiveFrom: string }[];
  isActive: boolean;
  createdBy?: number | null;
  createdDate: string;
  editBy?: number | null;
  editDate: string | null;
}

export type ProjectPayload = {
  name: string;
  code: string;
  description?: string | null;
  customerId: string;
  siteId: string;
  assignedUserIds: string[];
  rateOverrides?: {
    productId: string;
    rate: number;
    effectiveFrom: string;
    reason?: string | null;
  }[];
  rateChangeReason?: string | null;
  isActive: boolean;
};

export interface ProjectListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  siteId?: string;
  customerId?: string;
}

const listQuery = (params: ProjectListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
  ...(params.siteId != null ? { SiteId: params.siteId } : {}),
  ...(params.customerId != null ? { CustomerId: params.customerId } : {}),
});

function normalizePaged(
  data: PagedResult<ApiProject> | ApiProject[] | null | undefined,
): PagedResult<ApiProject> {
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

export const projectsService = {
  list: async (params: ProjectListParams = {}) => {
    const res = await http.get<ApiEnvelope<PagedResult<ApiProject> | ApiProject[]>>("Projects", {
      params: listQuery(params),
    });
    return { ...res, data: normalizePaged(res.data) };
  },
  get: (id: string) => http.get<ApiEnvelope<ApiProject>>(`Projects/${id}`),
  create: (payload: ProjectPayload) => http.post<ApiEnvelope<ApiProject>>("Projects", payload),
  update: (id: string, payload: ProjectPayload) =>
    http.put<ApiEnvelope<ApiProject>>(`Projects/${id}`, payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`Projects/${id}`),
};
