import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiJobTypeTemplateItem {
  id: string;
  dayOffset: number;
  orderBy: number;
  tradeGroupId: string | null;
  tradeGroupName: string | null;
  productId: string | null;
  productName: string | null;
  quantity: number;
  notes: string | null;
}

export interface ApiJobType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  durationWorkingDays: number;
  orderBy: number;
  isActive: boolean;
  templateItems: ApiJobTypeTemplateItem[];
  createdBy?: number | null;
  createdDate?: string | null;
  editBy?: number | null;
  editDate?: string | null;
}

export interface JobTypeTemplateItemPayload {
  id?: string | null;
  dayOffset: number;
  orderBy: number;
  tradeGroupId?: string | null;
  productId?: string | null;
  quantity: number;
  notes?: string | null;
}

export interface JobTypePayload {
  name: string;
  code: string;
  description?: string | null;
  durationWorkingDays: number;
  orderBy: number;
  isActive: boolean;
  templateItems: JobTypeTemplateItemPayload[];
}

export interface JobTypeTemplatePreviewItem {
  dayOffset: number;
  workDate: string;
  tradeId: string | null;
  tradeName: string;
  tradeGroupId: string | null;
  tradeGroupName: string | null;
  productId: string | null;
  productName: string | null;
  quantity: number;
  rate: number;
}

export interface JobTypeTemplatePreview {
  jobTypeId: string;
  startDate: string;
  handOverDate: string | null;
  durationWorkingDays: number;
  items: JobTypeTemplatePreviewItem[];
}

export interface JobTypeListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

const listQuery = (params: JobTypeListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
});

export const jobTypesService = {
  list: (params: JobTypeListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiJobType>>>("JobTypes", { params: listQuery(params) }),
  get: (id: string) => http.get<ApiEnvelope<ApiJobType>>(`JobTypes/${id}`),
  preview: (id: string, startDate: string) =>
    http.get<ApiEnvelope<JobTypeTemplatePreview>>(`JobTypes/${id}/preview`, {
      params: { startDate },
    }),
  create: (payload: JobTypePayload) => http.post<ApiEnvelope<ApiJobType>>("JobTypes", payload),
  update: (id: string, payload: JobTypePayload) =>
    http.put<ApiEnvelope<ApiJobType>>(`JobTypes/${id}`, payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`JobTypes/${id}`),
};
