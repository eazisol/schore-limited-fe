import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiPayStatementSummary {
  id: number;
  operativeId: number;
  operativeName: string;
  tradeName: string | null;
  contractorNames: string | null;
  weekEnding: string;
  weekStart: string;
  statusId: number;
  statusCode: string;
  statusName: string;
  paymentStatusId: number;
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
  id: number;
  workDate: string;
  priceWork: number;
  dailyRateApplied: number;
  /** True when the daily-rate floor was applied (IsDailyRate + ticked work that day). */
  isDailyTicked: boolean;
  topUp: number;
  dayPay: number;
}

export interface ApiPayStatementLine {
  id: number;
  taskItemId: number | null;
  taskId: number | null;
  propertyId: number | null;
  propertyName: string | null;
  contractorId: number | null;
  contractorName: string | null;
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
  contractorId?: number;
  statusId?: number;
  paymentStatusId?: number;
  page?: number;
  pageSize?: number;
}

export interface ApiPayStatementExportLine {
  payStatementId: number;
  operativeId: number;
  operativeName: string;
  lineDate: string;
  propertyName: string | null;
  description: string;
  amount: number;
  isTopUp: boolean;
}

export interface ApiPayStatementExportBundle {
  contractorId: number;
  contractorName: string;
  weekEnding: string;
  weekStart: string;
  totalAmount: number;
  lines: ApiPayStatementExportLine[];
}

export interface ApiPayStatementExport {
  weekEnding: string;
  weekStart: string;
  contractors: ApiPayStatementExportBundle[];
}

const listQuery = (params: PayStatementListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  ...(params.weekEnding ? { WeekEnding: params.weekEnding } : {}),
  ...(params.contractorId != null ? { ContractorId: params.contractorId } : {}),
  ...(params.statusId != null ? { StatusId: params.statusId } : {}),
  ...(params.paymentStatusId != null ? { PaymentStatusId: params.paymentStatusId } : {}),
});

export const payStatementsService = {
  list: (params: PayStatementListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiPayStatementSummary>>>("pay-statements", {
      params: listQuery(params),
    }),
  get: (id: number | string) =>
    http.get<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}`),
  send: (id: number | string) =>
    http.post<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}/send`),
  resend: (id: number | string) =>
    http.post<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}/resend`),
  markPaid: (id: number | string, payload: { paidNote?: string; file?: File | null }) => {
    const form = new FormData();
    if (payload.paidNote?.trim()) form.append("PaidNote", payload.paidNote.trim());
    if (payload.file) form.append("referenceFile", payload.file);
    return http.post<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}/mark-paid`, form);
  },
  export: (params: { weekEnding: string; contractorId?: number }) =>
    http.get<ApiEnvelope<ApiPayStatementExport>>("pay-statements/export", {
      params: {
        WeekEnding: params.weekEnding,
        ...(params.contractorId != null ? { ContractorId: params.contractorId } : {}),
      },
    }),
  respond: (id: number | string, payload: { accepted: boolean; reason?: string }) =>
    http.post<ApiEnvelope<ApiPayStatementDetail>>(`pay-statements/${id}/respond`, payload),
  listMine: (params: PayStatementListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiPayStatementSummary>>>("operatives/me/statements", {
      params: listQuery(params),
    }),
  getMine: (id: number | string) =>
    http.get<ApiEnvelope<ApiPayStatementDetail>>(`operatives/me/statements/${id}`),
};
