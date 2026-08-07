import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiTaskItem {
  id: number;
  taskId: number;
  operativeId: number;
  operativeName: string;
  workDate: string;
  tradeId: number;
  tradeName: string;
  tradeGroupId: number | null;
  tradeGroupName: string | null;
  productId: number | null;
  productName: string | null;
  quantity: number;
  rate: number;
  amount: number;
  statusId: number | null;
  statusName: string | null;
  isTicked: boolean;
  completedDate: string | null;
  timeSlotId: number | null;
  timeSlotName: string | null;
  timeSlotCode: string | null;
  notes: string | null;
  imagePath: string | null;
}

export interface ApiTaskOperativeGroup {
  operativeId: number;
  operativeName: string;
  items: ApiTaskItem[];
}

export interface ApiTask {
  id: number;
  taskNumber: string;
  propertyId: number;
  propertyName: string;
  propertyAddress: string | null;
  /** Property contractor — same source as Daily Programmer "Contractor". */
  contract: string | null;
  /** Property post code — same source as Daily Programmer "Post Code". */
  postCode: string | null;
  startDate: string;
  handOverDate: string | null;
  budget: number | null;
  jobTypeId: number;
  jobTypeName: string;
  description: string | null;
  statusId: number;
  statusName: string;
  statusCode: string;
  siteManagerId: number | null;
  siteManagerName: string | null;
  daysCount: number;
  heldDaysCount: number;
  isLocked: boolean;
  items: ApiTaskItem[];
  itemsByOperative: ApiTaskOperativeGroup[];
  createdDate: string;
  editDate: string | null;
}

export type TaskItemPayload = {
  id?: number | null;
  operativeId: number;
  workDate: string;
  tradeId: number;
  tradeGroupId?: number | null;
  productId?: number | null;
  quantity: number;
  rate: number;
  applyRatePermanently?: boolean;
  statusId?: number | null;
  isTicked?: boolean;
  completedDate?: string | null;
  timeSlotId?: number | null;
  notes?: string | null;
  imagePath?: string | null;
};

export type TaskPayload = {
  propertyId: number;
  startDate: string;
  handOverDate?: string | null;
  budget?: number | null;
  jobTypeId: number;
  description?: string | null;
  statusId: number;
  siteManagerId?: number | null;
  holdDate?: string | null;
  holdReasonId?: number | null;
  holdNotes?: string | null;
  items: TaskItemPayload[];
};

export interface TaskListParams {
  page: number;
  pageSize: number;
  search?: string;
  propertyId?: number;
  statusId?: number;
  jobTypeId?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

function listQuery(params: TaskListParams) {
  return {
    Page: params.page,
    PageSize: params.pageSize,
    Search: params.search ?? "",
    ...(params.propertyId != null ? { PropertyId: params.propertyId } : {}),
    ...(params.statusId != null ? { StatusId: params.statusId } : {}),
    ...(params.jobTypeId != null ? { JobTypeId: params.jobTypeId } : {}),
    ...(params.sortBy ? { SortBy: params.sortBy } : {}),
    ...(params.sortDir ? { SortDir: params.sortDir } : {}),
  };
}

function normalizePaged(
  data: PagedResult<ApiTask> | ApiTask[] | null | undefined,
): PagedResult<ApiTask> {
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

export interface ApiTimeSlot {
  id: number;
  name: string;
  code: string;
  description: string | null;
  orderBy: number;
  isActive: boolean;
}

export const tasksService = {
  list: async (params: TaskListParams) => {
    const res = await http.get<ApiEnvelope<PagedResult<ApiTask> | ApiTask[]>>("Tasks", {
      params: listQuery(params),
    });
    return { ...res, data: normalizePaged(res.data) };
  },
  get: (id: number | string) => http.get<ApiEnvelope<ApiTask>>(`Tasks/${id}`),
  create: (payload: TaskPayload) => http.post<ApiEnvelope<ApiTask>>("Tasks", payload),
  update: (id: number | string, payload: TaskPayload) =>
    http.put<ApiEnvelope<ApiTask>>(`Tasks/${id}`, payload),
  remove: (id: number | string) => http.delete<ApiEnvelope<null>>(`Tasks/${id}`),
  timeSlots: () => http.get<ApiEnvelope<ApiTimeSlot[]>>("Tasks/time-slots"),
};
