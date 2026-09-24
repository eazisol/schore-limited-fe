import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiTaskItem {
  id: string;
  taskId: string;
  operativeId: string | null;
  operativeName: string;
  workDate: string;
  tradeId: string | null;
  tradeName: string;
  tradeGroupId: string | null;
  tradeGroupName: string | null;
  productId: string | null;
  productName: string | null;
  quantity: number;
  doneQty: number;
  remainingQty: number;
  rate: number;
  amount: number;
  statusId: string | null;
  statusName: string | null;
  isTicked: boolean;
  /** True when this line was created as a repeat assignment. */
  isRepeat?: boolean;
  completedDate: string | null;
  timeSlotId: string | null;
  timeSlotName: string | null;
  timeSlotCode: string | null;
  notes: string | null;
  imagePath: string | null;
  /** PENDING | REJECTED when over-cap rate needs / was denied approval. */
  rateApprovalStatus?: string | null;
  rateChangeRequestId?: string | null;
  proposedRate?: number | null;
  rateChangeReason?: string | null;
  rateReviewReason?: string | null;
}

export interface ApiTaskOperativeGroup {
  operativeId: string | null;
  operativeName: string;
  items: ApiTaskItem[];
}

export interface ApiTask {
  id: string;
  taskNumber: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string | null;
  /** Property customer — same source as Daily Programmer "Customer". */
  contract: string | null;
  /** Property post code — same source as Daily Programmer "Post Code". */
  postCode: string | null;
  startDate: string;
  handOverDate: string | null;
  budget: number | null;
  jobTypeId: string;
  jobTypeName: string;
  description: string | null;
  statusId: string;
  statusName: string;
  statusCode: string;
  siteManagerId: string | null;
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
  id?: string | null;
  operativeId: string | null;
  workDate: string;
  tradeId: string | null;
  tradeGroupId?: string | null;
  productId?: string | null;
  quantity: number;
  doneQty?: number;
  rate: number;
  applyRatePermanently?: boolean;
  reason?: string | null;
  statusId?: string | null;
  isTicked?: boolean;
  completedDate?: string | null;
  timeSlotId?: string | null;
  notes?: string | null;
  imagePath?: string | null;
};

export type TaskItemRemovalPayload = {
  itemId: string;
  reason: string;
};

export type TaskPayload = {
  propertyId: string;
  startDate: string;
  handOverDate?: string | null;
  budget?: number | null;
  jobTypeId: string;
  description?: string | null;
  statusId: string;
  siteManagerId?: string | null;
  holdDate?: string | null;
  holdReasonId?: string | null;
  holdNotes?: string | null;
  items: TaskItemPayload[];
  itemRemovals?: TaskItemRemovalPayload[];
};

export interface ApiTaskTimelineEntry {
  id: string;
  taskId: string;
  taskItemId: string | null;
  action: string;
  summary: string | null;
  reason: string | null;
  actorUserId: string | null;
  actorName: string;
  itemLabel: string | null;
  workDate: string | null;
  previousRate: number | null;
  newRate: number | null;
  previousStatus: string | null;
  newStatus: string | null;
  createdDate: string;
}

export interface TaskListParams {
  page: number;
  pageSize: number;
  search?: string;
  propertyId?: string;
  statusId?: string;
  jobTypeId?: string;
  customerId?: string;
  operativeId?: string;
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
    ...(params.customerId != null ? { CustomerId: params.customerId } : {}),
    ...(params.operativeId != null ? { OperativeId: params.operativeId } : {}),
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

export interface ApiTaskItemListRow {
  id: string;
  taskId: string;
  taskNumber: string;
  propertyName: string;
  jobTypeName: string | null;
  workDate: string;
  tradeId: string | null;
  tradeName: string;
  tradeGroupId: string | null;
  tradeGroupName: string | null;
  productId: string | null;
  productName: string | null;
  quantity: number;
  doneQty: number;
  rate: number;
  amount: number;
  statusId: string | null;
  statusName: string | null;
  statusCode: string | null;
  isTicked: boolean;
  timeSlotName: string | null;
}

export interface TaskItemListParams {
  page: number;
  pageSize: number;
  operativeId?: string;
  statusId?: string;
  /** TASK_ITEM code; PENDING maps server-side to Draft / unset. */
  statusCode?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

function itemListQuery(params: TaskItemListParams) {
  return {
    Page: params.page,
    PageSize: params.pageSize,
    ...(params.operativeId != null ? { OperativeId: params.operativeId } : {}),
    ...(params.statusId != null ? { StatusId: params.statusId } : {}),
    ...(params.statusCode ? { StatusCode: params.statusCode } : {}),
    ...(params.sortBy ? { SortBy: params.sortBy } : {}),
    ...(params.sortDir ? { SortDir: params.sortDir } : {}),
  };
}

function normalizeItemPaged(
  data: PagedResult<ApiTaskItemListRow> | ApiTaskItemListRow[] | null | undefined,
): PagedResult<ApiTaskItemListRow> {
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
  id: string;
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
  listItems: async (params: TaskItemListParams) => {
    const res = await http.get<
      ApiEnvelope<PagedResult<ApiTaskItemListRow> | ApiTaskItemListRow[]>
    >("Tasks/items", {
      params: itemListQuery(params),
    });
    return { ...res, data: normalizeItemPaged(res.data) };
  },
  get: (id: string) => http.get<ApiEnvelope<ApiTask>>(`Tasks/${id}`),
  getTimeline: (id: string) =>
    http.get<ApiEnvelope<ApiTaskTimelineEntry[]>>(`Tasks/${id}/timeline`),
  create: (payload: TaskPayload) => http.post<ApiEnvelope<ApiTask>>("Tasks", payload),
  update: (id: string, payload: TaskPayload) =>
    http.put<ApiEnvelope<ApiTask>>(`Tasks/${id}`, payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`Tasks/${id}`),
  timeSlots: () => http.get<ApiEnvelope<ApiTimeSlot[]>>("Tasks/time-slots"),
  resolveRate: (params: {
    propertyId: string;
    date: string;
    productId?: string;
    tradeGroupId?: string;
    operativeId?: string;
  }) =>
    http.get<ApiEnvelope<{ rate: number; cap: number }>>("Tasks/resolve-rate", {
      params: {
        PropertyId: params.propertyId,
        Date: params.date,
        ...(params.productId ? { ProductId: params.productId } : {}),
        ...(params.tradeGroupId ? { TradeGroupId: params.tradeGroupId } : {}),
        ...(params.operativeId ? { OperativeId: params.operativeId } : {}),
      },
    }),
};
