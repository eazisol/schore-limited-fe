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

export interface ApiTrade {
  id: number;
  name: string;
  description: string | null;
  groupCount: number;
  taskCount: number;
  isActive: boolean;
  createdDate: string;
  editDate: string | null;
}

export type TradePayload = {
  name: string;
  description?: string | null;
  isActive: boolean;
};

export type TradesSortBy = "name" | "groups" | "tasks" | "status";
export type TradesSortDir = "asc" | "desc";

export interface TradesListParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: "active" | "inactive";
  sortBy?: TradesSortBy;
  sortDir?: TradesSortDir;
}

const seed: ApiTrade[] = [
  {
    id: 1,
    name: "Carpenter",
    description: "Kitchen, doors and carcass work",
    groupCount: 4,
    taskCount: 18,
    isActive: true,
    createdDate: "2025-01-10T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 2,
    name: "Plumber",
    description: "1st/2nd fix and heating",
    groupCount: 3,
    taskCount: 11,
    isActive: true,
    createdDate: "2025-01-10T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 3,
    name: "Electrician",
    description: "1st/2nd fix electrics",
    groupCount: 3,
    taskCount: 9,
    isActive: true,
    createdDate: "2025-01-10T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 4,
    name: "Tiler",
    description: "Wall and floor tiling",
    groupCount: 2,
    taskCount: 6,
    isActive: true,
    createdDate: "2025-01-12T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 5,
    name: "Labourer",
    description: "General site labour",
    groupCount: 2,
    taskCount: 5,
    isActive: true,
    createdDate: "2025-01-12T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 6,
    name: "Painter",
    description: "Decoration and finishing",
    groupCount: 2,
    taskCount: 7,
    isActive: true,
    createdDate: "2025-02-01T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 7,
    name: "Plasterer",
    description: "Board and skim",
    groupCount: 1,
    taskCount: 3,
    isActive: false,
    createdDate: "2025-02-01T09:00:00.000Z",
    editDate: "2026-01-08T14:00:00.000Z",
  },
];

const store = createMockStore<ApiTrade>({
  seed,
  getSearchText: (t) => [t.name, t.description ?? ""].join(" "),
  matchesFilter: (t, params) => {
    const status = params.status === "active" || params.status === "inactive" ? params.status : undefined;
    if (status === "active" && !t.isActive) return false;
    if (status === "inactive" && t.isActive) return false;
    return true;
  },
  defaultSortBy: "name",
  sorters: {
    name: (a, b) => compareString(a.name, b.name),
    groups: (a, b) => compareNumber(a.groupCount, b.groupCount),
    tasks: (a, b) => compareNumber(a.taskCount, b.taskCount),
    status: (a, b) => compareBool(a.isActive, b.isActive),
  },
});

/**
 * Trade Management service — mock adapter.
 * Replace with `http` calls to Trades endpoints when the API is ready.
 */
export const tradesService = {
  list: async (params: TradesListParams): Promise<ApiEnvelope<PagedResult<ApiTrade>>> => {
    await mockDelay();
    return mockOk(store.list({ ...params }));
  },
  get: async (id: number | string): Promise<ApiEnvelope<ApiTrade>> => {
    await mockDelay();
    return mockOk(store.get(id));
  },
  /** Lookup helper for selects (operatives, etc.). */
  options: async (): Promise<ApiEnvelope<ApiTrade[]>> => {
    await mockDelay(120);
    return mockOk(store.all().filter((t) => t.isActive));
  },
  create: async (payload: TradePayload): Promise<ApiEnvelope<ApiTrade>> => {
    await mockDelay();
    const created = store.create({
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      isActive: payload.isActive,
      groupCount: 0,
      taskCount: 0,
      createdDate: nowIso(),
      editDate: null,
    });
    return mockOk(created, "Trade created");
  },
  update: async (id: number | string, payload: TradePayload): Promise<ApiEnvelope<ApiTrade>> => {
    await mockDelay();
    const updated = store.update(id, {
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      isActive: payload.isActive,
      editDate: nowIso(),
    });
    return mockOk(updated, "Trade updated");
  },
  remove: async (id: number | string): Promise<ApiEnvelope<null>> => {
    await mockDelay();
    store.remove(id);
    return mockOk(null, "Trade deleted");
  },
};
