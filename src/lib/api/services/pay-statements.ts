import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiPayStatementSummary {
  id: string;
  operativeId: string;
  operativeName: string;
  tradeName: string | null;
  customerNames: string | null;
  weekEnding: string;
  weekStart: string;
  statusId: string;
  statusCode: string;
  statusName: string;
  paymentStatusId: string;
  paymentStatusCode: string;
  paymentStatusName: string;
  gross: number;
  cisRate: number;
  cisDeduction: number;
  net: number;
  sentDate: string | null;
  approveDate: string | null;
  rejectDate: string | null;
  refusalReason: string | null;
  paidDate: string | null;
}

export interface ApiPayStatementDay {
  id: string;
  workDate: string;
  priceWork: number;
  dailyRateApplied: number;
  /** True when the daily-rate floor was applied (IsDailyRate + ticked work that day). */
  isDailyTicked: boolean;
  topUp: number;
  dayPay: number;
}

export interface ApiPayStatementLine {
  id: string;
  taskItemId: string | null;
  taskId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  customerId: string | null;
  customerName: string | null;
  lineDate: string;
  description: string;
  amount: number;
  isTopUp: boolean;
}

export interface ApiPayStatementDetail extends ApiPayStatementSummary {
  operativeEmail: string | null;
  operativeTradeCode: string | null;
  sentBy: number | null;
  sentByName: string | null;
  respondedBy: number | null;
  respondedByName: string | null;
  paidBy: number | null;
  paidByName: string | null;
  paidNote: string | null;
  paidReferenceFilePath: string | null;
  days: ApiPayStatementDay[];
  lines: ApiPayStatementLine[];
}

export interface PayStatementListParams {
  weekEnding?: string;
  customerId?: string;
  statusId?: string;
  paymentStatusId?: string;
  page?: number;
  pageSize?: number;
}

export interface ApiPayStatementExportLine {
  payStatementId: string;
  operativeId: string;
  operativeName: string;
  lineDate: string;
  propertyName: string | null;
  description: string;
  amount: number;
  isTopUp: boolean;
}

export interface ApiPayStatementExportBundle {
  customerId: string;
  customerName: string;
  weekEnding: string;
  weekStart: string;
  totalAmount: number;
  lines: ApiPayStatementExportLine[];
}

export interface ApiPayStatementExport {
  weekEnding: string;
  weekStart: string;
  customers: ApiPayStatementExportBundle[];
}

const listQuery = (params: PayStatementListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  ...(params.weekEnding ? { WeekEnding: params.weekEnding } : {}),
  ...(params.customerId != null ? { CustomerId: params.customerId } : {}),
  ...(params.statusId != null ? { StatusId: params.statusId } : {}),
  ...(params.paymentStatusId != null ? { PaymentStatusId: params.paymentStatusId } : {}),
});

export const payStatementsService = {
  list: (params: PayStatementListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiPayStatementSummary>>>("pay-statements", {
      params: listQuery(params),
    }),
  get: (id: string) =>
    http.get<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}`),
  send: (id: string) =>
    http.post<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}/send`),
  resend: (id: string) =>
    http.post<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}/resend`),
  markPaid: (id: string, payload: { paidNote?: string; file?: File | null }) => {
    const form = new FormData();
    if (payload.paidNote?.trim()) form.append("PaidNote", payload.paidNote.trim());
    if (payload.file) form.append("referenceFile", payload.file);
    return http.post<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}/mark-paid`, form);
  },
  export: (params: { weekEnding: string; customerId?: number }) =>
    http.get<ApiEnvelope<ApiPayStatementExport>>("pay-statements/export", {
      params: {
        WeekEnding: params.weekEnding,
        ...(params.customerId != null ? { CustomerId: params.customerId } : {}),
      },
    }),
  respond: (id: string, payload: { accepted: boolean; reason?: string }) =>
    http.post<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}/respond`, payload),
  listMine: (params: PayStatementListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiPayStatementSummary>>>("operatives/me/statements", {
      params: listQuery(params),
    }),
  getMine: (id: string) =>
    http.get<ApiEnvelope<ApiPayStatementDetail>>(`operatives/me/statements/${id}`),
};
