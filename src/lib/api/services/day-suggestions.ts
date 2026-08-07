import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiDaySuggestion {
  id: number;
  dayNumber: number;
  /** Derived from linked trade codes for display / Next Day. */
  codes: string;
  tradeIds: number[];
  tradeCodes: string[];
  tradeNames: string[];
  description: string | null;
  orderBy: number;
  isActive: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  editBy?: number | null;
  editDate?: string | null;
}

export interface DaySuggestionPayload {
  dayNumber: number;
  tradeIds: number[];
  description?: string | null;
  orderBy: number;
  isActive: boolean;
}

export interface DaySuggestionListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

const listQuery = (params: DaySuggestionListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
});

export const daySuggestionsService = {
  list: (params: DaySuggestionListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiDaySuggestion>>>("DaySuggestions", {
      params: listQuery(params),
    }),
  get: (id: number | string) =>
    http.get<ApiEnvelope<ApiDaySuggestion>>(`DaySuggestions/${id}`),
  create: (payload: DaySuggestionPayload) =>
    http.post<ApiEnvelope<ApiDaySuggestion>>("DaySuggestions", payload),
  update: (id: number | string, payload: DaySuggestionPayload) =>
    http.put<ApiEnvelope<ApiDaySuggestion>>(`DaySuggestions/${id}`, payload),
  remove: (id: number | string) =>
    http.delete<ApiEnvelope<null>>(`DaySuggestions/${id}`),
};
