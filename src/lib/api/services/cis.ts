import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";
import {
  compareBool,
  compareNumber,
  compareString,
  createMockStore,
  mockDelay,
  mockOk,
  nowIso,
} from "./mock-crud";

export interface ApiCisStatus {
  id: number;
  code: string;
  name: string;
  rate: number;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdDate: string;
  editDate: string | null;
}

export type CisStatusPayload = {
  code: string;
  name: string;
  rate: number;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export type CisSortBy = "name" | "code" | "rate" | "status";
export type CisSortDir = "asc" | "desc";

export interface CisListParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: "active" | "inactive";
  sortBy?: CisSortBy;
  sortDir?: CisSortDir;
}

const seed: ApiCisStatus[] = [
  {
    id: 1,
    code: "GROSS",
    name: "Gross (0%)",
    rate: 0,
    description: "No CIS deduction — verified gross payment",
    isDefault: false,
    isActive: true,
    createdDate: "2025-01-01T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 2,
    code: "NET",
    name: "Net (20%)",
    rate: 20,
    description: "Standard CIS deduction for verified subcontractors",
    isDefault: true,
    isActive: true,
    createdDate: "2025-01-01T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 3,
    code: "UNVERIFIED",
    name: "Unverified (30%)",
    rate: 30,
    description: "Higher deduction when UTR / verification is missing",
    isDefault: false,
    isActive: true,
    createdDate: "2025-01-01T09:00:00.000Z",
    editDate: null,
  },
];

const store = createMockStore<ApiCisStatus>({
  seed,
  getSearchText: (c) => [c.code, c.name, String(c.rate), c.description ?? ""].join(" "),
  matchesFilter: (c, params) => {
    const status = params.status === "active" || params.status === "inactive" ? params.status : undefined;
    if (status === "active" && !c.isActive) return false;
    if (status === "inactive" && c.isActive) return false;
    return true;
  },
  defaultSortBy: "rate",
  sorters: {
    name: (a, b) => compareString(a.name, b.name),
    code: (a, b) => compareString(a.code, b.code),
    rate: (a, b) => compareNumber(a.rate, b.rate),
    status: (a, b) => compareBool(a.isActive, b.isActive),
  },
});

function clearOtherDefaults(exceptId?: number) {
  for (const row of store.all()) {
    if (row.isDefault && row.id !== exceptId) {
      store.update(row.id, { isDefault: false, editDate: nowIso() });
    }
  }
}

/**
 * CIS Management service — mock adapter.
 * Replace with `http` calls to CisStatuses endpoints when the API is ready.
 */
export const cisService = {
  list: async (params: CisListParams): Promise<ApiEnvelope<PagedResult<ApiCisStatus>>> => {
    await mockDelay();
    return mockOk(store.list({ ...params }));
  },
  get: async (id: number | string): Promise<ApiEnvelope<ApiCisStatus>> => {
    await mockDelay();
    return mockOk(store.get(id));
  },
  options: async (): Promise<ApiEnvelope<ApiCisStatus[]>> => {
    await mockDelay(120);
    return mockOk(store.all().filter((c) => c.isActive));
  },
  create: async (payload: CisStatusPayload): Promise<ApiEnvelope<ApiCisStatus>> => {
    await mockDelay();
    if (payload.isDefault) clearOtherDefaults();
    const created = store.create({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      rate: payload.rate,
      description: payload.description?.trim() || null,
      isDefault: payload.isDefault,
      isActive: payload.isActive,
      createdDate: nowIso(),
      editDate: null,
    });
    return mockOk(created, "CIS status created");
  },
  update: async (
    id: number | string,
    payload: CisStatusPayload,
  ): Promise<ApiEnvelope<ApiCisStatus>> => {
    await mockDelay();
    if (payload.isDefault) clearOtherDefaults(Number(id));
    const updated = store.update(id, {
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      rate: payload.rate,
      description: payload.description?.trim() || null,
      isDefault: payload.isDefault,
      isActive: payload.isActive,
      editDate: nowIso(),
    });
    return mockOk(updated, "CIS status updated");
  },
  remove: async (id: number | string): Promise<ApiEnvelope<null>> => {
    await mockDelay();
    store.remove(id);
    return mockOk(null, "CIS status deleted");
  },
};
