import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiHoliday {
  id: string;
  name: string;
  date: string;
  description: string | null;
  isActive: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  editBy?: number | null;
  editDate?: string | null;
}

export interface HolidayPayload {
  name: string;
  date: string;
  description?: string | null;
  isActive: boolean;
}

export interface ApiWeekendDays {
  days: number[];
  weekEndingDay: number;
  weekEndingDayName: string;
}

export interface HolidayListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

const listQuery = (params: HolidayListParams) => ({
  Page: params.page ?? 1,
  PageSize: params.pageSize ?? 100,
  Search: params.search ?? "",
  ...(params.dateFrom ? { DateFrom: params.dateFrom } : {}),
  ...(params.dateTo ? { DateTo: params.dateTo } : {}),
});

export const holidaysService = {
  list: (params: HolidayListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiHoliday>>>("Holidays", { params: listQuery(params) }),
  get: (id: string) => http.get<ApiEnvelope<ApiHoliday>>(`Holidays/${id}`),
  getWeekend: () => http.get<ApiEnvelope<ApiWeekendDays>>("Holidays/weekend"),
  saveWeekend: (days: number[]) =>
    http.put<ApiEnvelope<ApiWeekendDays>>("Holidays/weekend", { days }),
  create: (payload: HolidayPayload) => http.post<ApiEnvelope<ApiHoliday>>("Holidays", payload),
  update: (id: string, payload: HolidayPayload) =>
    http.put<ApiEnvelope<ApiHoliday>>(`Holidays/${id}`, payload),
  remove: (id: string) => http.delete<ApiEnvelope<null>>(`Holidays/${id}`),
};
