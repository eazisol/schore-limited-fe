import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiDocumentType {
  id: number;
  name: string;
  code: string;
  description: string | null;
  orderBy: number;
  isActive: boolean;
}

export const documentTypesService = {
  list: (params: { page?: number; pageSize?: number; search?: string } = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiDocumentType>>>("DocumentTypes", {
      params: {
        Page: params.page ?? 1,
        PageSize: params.pageSize ?? 100,
        Search: params.search ?? "",
      },
    }),
};

export async function fetchDocumentTypeOptions(search: string) {
  const res = await documentTypesService.list({ page: 1, pageSize: 50, search });
  return (res.data.items ?? [])
    .filter((row) => row.isActive)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || row.code,
    }));
}
