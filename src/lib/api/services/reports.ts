import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export type TaskReportGroupBy = "Client" | "Site" | "Project" | "Property";

export interface ApiTaskReportRow {
  jobId: string;
  taskNumber: string;
  jobTypeName: string;
  statusCode: string;
  statusName: string;
  customerId: string;
  customerName: string | null;
  siteId: string;
  siteName: string | null;
  projectId: string;
  projectName: string | null;
  propertyId: string;
  propertyName: string | null;
  startDate: string;
  handOverDate: string | null;
  daysElapsed: number;
  daysPlanned: number;
  quantity: number;
  completedCount: number;
  itemCount: number;
  amount: number;
}

export interface ApiTaskReportStatusCount {
  code: string;
  name: string;
  count: number;
}

export interface ApiTaskReportGroupStat {
  label: string;
  entityId: string | null;
  jobCount: number;
  completedCount: number;
  itemCount: number;
  completionPercent: number;
  amount: number;
  statusCounts: ApiTaskReportStatusCount[];
}

export interface ApiTaskReport {
  groupBy: TaskReportGroupBy | number;
  fromDate: string | null;
  toDate: string | null;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  totalJobs: number;
  totalQuantity: number;
  totalCompleted: number;
  totalItems: number;
  completionPercent: number;
  totalAmount: number;
  statusCounts: ApiTaskReportStatusCount[];
  groupStats: ApiTaskReportGroupStat[];
  rows: ApiTaskReportRow[];
}

export interface TaskReportParams {
  groupBy?: TaskReportGroupBy;
  fromDate?: string;
  toDate?: string;
  customerId?: string;
  siteId?: string;
  projectId?: string;
  propertyId?: string;
  userId?: string;
  operativeId?: string;
  statusId?: string;
  page?: number;
  pageSize?: number;
}

export interface ApiWagesReportRow {
  id: string;
  invoiceNumber: number;
  operativeId: string;
  operativeName: string;
  tradeName: string | null;
  customerNames: string | null;
  projectId: string;
  projectName: string | null;
  projectCode: string | null;
  siteName: string | null;
  weekEnding: string;
  weekStart: string;
  statusCode: string;
  statusName: string;
  paymentStatusCode: string;
  paymentStatusName: string;
  gross: number;
  cisRate: number;
  cisDeduction: number;
  net: number;
  isPartial: boolean;
  paidDate: string | null;
}

export interface ApiWagesStatusCount {
  code: string;
  name: string;
  count: number;
}

export interface ApiWagesChartPoint {
  label: string;
  gross: number;
  cisDeduction: number;
  net: number;
  count: number;
}

export interface ApiWagesReport {
  fromDate: string | null;
  toDate: string | null;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  statementCount: number;
  totalGross: number;
  totalCisDeduction: number;
  totalNet: number;
  statusCounts: ApiWagesStatusCount[];
  chartSummary: ApiWagesChartPoint[];
  chartByOperative: ApiWagesChartPoint[];
  chartByWeek: ApiWagesChartPoint[];
  chartByStatus: ApiWagesChartPoint[];
  chartByClient: ApiWagesChartPoint[];
  chartByProject: ApiWagesChartPoint[];
  rows: ApiWagesReportRow[];
}

export interface WagesReportParams {
  fromDate?: string;
  toDate?: string;
  customerId?: string;
  projectId?: string;
  statusId?: string;
  paymentStatusId?: string;
  page?: number;
  pageSize?: number;
}

export const reportsService = {
  getTaskReport: (params: TaskReportParams = {}) =>
    http.get<ApiEnvelope<ApiTaskReport>>("reports/tasks", {
      params: {
        GroupBy: params.groupBy ?? "Client",
        Page: params.page ?? 1,
        PageSize: params.pageSize ?? 10,
        ...(params.fromDate ? { FromDate: params.fromDate } : {}),
        ...(params.toDate ? { ToDate: params.toDate } : {}),
        ...(params.customerId ? { CustomerId: params.customerId } : {}),
        ...(params.siteId ? { SiteId: params.siteId } : {}),
        ...(params.projectId ? { ProjectId: params.projectId } : {}),
        ...(params.propertyId ? { PropertyId: params.propertyId } : {}),
        ...(params.userId ? { UserId: params.userId } : {}),
        ...(params.operativeId ? { OperativeId: params.operativeId } : {}),
        ...(params.statusId ? { StatusId: params.statusId } : {}),
      },
    }),

  getWagesReport: (params: WagesReportParams = {}) =>
    http.get<ApiEnvelope<ApiWagesReport>>("reports/wages", {
      params: {
        Page: params.page ?? 1,
        PageSize: params.pageSize ?? 10,
        ...(params.fromDate ? { FromDate: params.fromDate } : {}),
        ...(params.toDate ? { ToDate: params.toDate } : {}),
        ...(params.customerId ? { CustomerId: params.customerId } : {}),
        ...(params.projectId ? { ProjectId: params.projectId } : {}),
        ...(params.statusId ? { StatusId: params.statusId } : {}),
        ...(params.paymentStatusId ? { PaymentStatusId: params.paymentStatusId } : {}),
      },
    }),
};
