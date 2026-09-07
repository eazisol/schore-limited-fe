import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiRateChangeRequest {
  id: string;
  scope: string;
  action: string;
  statusId: string;
  statusCode: string;
  statusName: string;
  productId: string;
  productName: string;
  parentLabel: string;
  previousRate: number | null;
  proposedRate: number;
  effectiveFrom: string;
  reason: string;
  exceedsCap: boolean;
  canApprove: boolean;
  requestedBy: string;
  requestedByName: string;
  requestedDate: string;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedDate: string | null;
  reviewReason: string | null;
}

export interface RateChangeRequestListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  statusId?: string;
  customerId?: string;
  siteId?: string;
  projectId?: string;
  operativeId?: string;
}

export const RATE_APPROVALS_ROUTE = "/rate-approvals";
export const rateChangeRequestsQueryKey = ["rate-change-requests"] as const;

export const rateChangeRequestsService = {
  list: (params: RateChangeRequestListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiRateChangeRequest>>>("RateChangeRequests", {
      params: {
        Page: params.page ?? 1,
        PageSize: params.pageSize ?? 10,
        Search: params.search ?? "",
        ...(params.statusId ? { StatusId: params.statusId } : {}),
        ...(params.customerId ? { CustomerId: params.customerId } : {}),
        ...(params.siteId ? { SiteId: params.siteId } : {}),
        ...(params.projectId ? { ProjectId: params.projectId } : {}),
        ...(params.operativeId ? { OperativeId: params.operativeId } : {}),
      },
    }),
  approve: (id: string) =>
    http.post<ApiEnvelope<ApiRateChangeRequest>>(`RateChangeRequests/${id}/approve`),
  reject: (id: string, reason: string) =>
    http.post<ApiEnvelope<ApiRateChangeRequest>>(`RateChangeRequests/${id}/reject`, { reason }),
};

export function rateScopeLabel(scope: string): string {
  switch (scope.toUpperCase()) {
    case "CLIENT":
      return "Client";
    case "SITE":
      return "Site";
    case "PROJECT":
      return "Project";
    case "OPERATIVE":
      return "Operative";
    default:
      return scope;
  }
}

export function rateActionLabel(action: string): string {
  return action.toUpperCase() === "REMOVE" ? "Remove" : "Set";
}

