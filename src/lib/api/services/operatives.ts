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

export interface ApiOperative {
  id: number;
  name: string;
  tradeId: number;
  tradeName: string;
  cisRate: number;
  dailyRate: number;
  phone: string | null;
  email: string | null;
  utr: string | null;
  emergencyContact: string | null;
  startDate: string | null;
  isActive: boolean;
  createdDate: string;
  editDate: string | null;
}

export type OperativePayload = {
  name: string;
  tradeId: number;
  tradeName: string;
  cisRate: number;
  dailyRate: number;
  phone?: string | null;
  email?: string | null;
  utr?: string | null;
  emergencyContact?: string | null;
  startDate?: string | null;
  isActive: boolean;
};

export type OperativesSortBy = "name" | "trade" | "cis" | "dailyRate" | "status";
export type OperativesSortDir = "asc" | "desc";

export interface OperativesListParams {
  page: number;
  pageSize: number;
  search?: string;
  tradeId?: number;
  sortBy?: OperativesSortBy;
  sortDir?: OperativesSortDir;
}

const seed: ApiOperative[] = [
  {
    id: 1,
    name: "Aurelian Popescu",
    tradeId: 1,
    tradeName: "Carpenter",
    cisRate: 20,
    dailyRate: 240,
    phone: "07700 900112",
    email: null,
    utr: "1234567890",
    emergencyContact: null,
    startDate: "2024-03-04",
    isActive: true,
    createdDate: "2024-03-04T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 2,
    name: "Zoltan Miron",
    tradeId: 1,
    tradeName: "Carpenter",
    cisRate: 20,
    dailyRate: 240,
    phone: "07700 900113",
    email: null,
    utr: "2234567890",
    emergencyContact: null,
    startDate: "2023-11-12",
    isActive: true,
    createdDate: "2023-11-12T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 3,
    name: "Vasile Ionescu",
    tradeId: 4,
    tradeName: "Tiler",
    cisRate: 20,
    dailyRate: 220,
    phone: "07700 900114",
    email: null,
    utr: "3234567890",
    emergencyContact: null,
    startDate: "2024-01-22",
    isActive: true,
    createdDate: "2024-01-22T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 4,
    name: "Marius Dragomir",
    tradeId: 2,
    tradeName: "Plumber",
    cisRate: 0,
    dailyRate: 260,
    phone: "07700 900115",
    email: null,
    utr: "4234567890",
    emergencyContact: null,
    startDate: "2022-08-09",
    isActive: true,
    createdDate: "2022-08-09T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 5,
    name: "Andrei Stoica",
    tradeId: 3,
    tradeName: "Electrician",
    cisRate: 20,
    dailyRate: 280,
    phone: "07700 900116",
    email: null,
    utr: "5234567890",
    emergencyContact: null,
    startDate: "2024-05-30",
    isActive: true,
    createdDate: "2024-05-30T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 6,
    name: "Cristian Vlad",
    tradeId: 6,
    tradeName: "Painter",
    cisRate: 30,
    dailyRate: 200,
    phone: "07700 900117",
    email: null,
    utr: "",
    emergencyContact: null,
    startDate: "2025-02-10",
    isActive: true,
    createdDate: "2025-02-10T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 7,
    name: "Bogdan Marin",
    tradeId: 5,
    tradeName: "Labourer",
    cisRate: 20,
    dailyRate: 160,
    phone: "07700 900118",
    email: null,
    utr: "7234567890",
    emergencyContact: null,
    startDate: "2024-09-01",
    isActive: true,
    createdDate: "2024-09-01T09:00:00.000Z",
    editDate: null,
  },
  {
    id: 8,
    name: "Stefan Radu",
    tradeId: 7,
    tradeName: "Plasterer",
    cisRate: 20,
    dailyRate: 230,
    phone: "07700 900119",
    email: null,
    utr: "8234567890",
    emergencyContact: null,
    startDate: "2023-04-18",
    isActive: false,
    createdDate: "2023-04-18T09:00:00.000Z",
    editDate: "2025-12-01T10:00:00.000Z",
  },
];

const store = createMockStore<ApiOperative>({
  seed,
  getSearchText: (o) =>
    [o.name, o.tradeName, o.phone ?? "", o.email ?? "", o.utr ?? ""].join(" "),
  matchesFilter: (o, params) => {
    const tradeId = typeof params.tradeId === "number" ? params.tradeId : undefined;
    if (tradeId != null && o.tradeId !== tradeId) return false;
    return true;
  },
  defaultSortBy: "name",
  sorters: {
    name: (a, b) => compareString(a.name, b.name),
    trade: (a, b) => compareString(a.tradeName, b.tradeName),
    cis: (a, b) => compareNumber(a.cisRate, b.cisRate),
    dailyRate: (a, b) => compareNumber(a.dailyRate, b.dailyRate),
    status: (a, b) => compareBool(a.isActive, b.isActive),
  },
});

/**
 * Operatives service — mock adapter.
 * Replace with `http` calls to Operatives endpoints when the API is ready.
 */
export const operativesService = {
  list: async (
    params: OperativesListParams,
  ): Promise<ApiEnvelope<PagedResult<ApiOperative>>> => {
    await mockDelay();
    return mockOk(store.list({ ...params }));
  },
  get: async (id: number | string): Promise<ApiEnvelope<ApiOperative>> => {
    await mockDelay();
    return mockOk(store.get(id));
  },
  create: async (payload: OperativePayload): Promise<ApiEnvelope<ApiOperative>> => {
    await mockDelay();
    const created = store.create({
      name: payload.name.trim(),
      tradeId: payload.tradeId,
      tradeName: payload.tradeName,
      cisRate: payload.cisRate,
      dailyRate: payload.dailyRate,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      utr: payload.utr?.trim() || null,
      emergencyContact: payload.emergencyContact?.trim() || null,
      startDate: payload.startDate?.trim() || null,
      isActive: payload.isActive,
      createdDate: nowIso(),
      editDate: null,
    });
    return mockOk(created, "Operative created");
  },
  update: async (
    id: number | string,
    payload: OperativePayload,
  ): Promise<ApiEnvelope<ApiOperative>> => {
    await mockDelay();
    const updated = store.update(id, {
      name: payload.name.trim(),
      tradeId: payload.tradeId,
      tradeName: payload.tradeName,
      cisRate: payload.cisRate,
      dailyRate: payload.dailyRate,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      utr: payload.utr?.trim() || null,
      emergencyContact: payload.emergencyContact?.trim() || null,
      startDate: payload.startDate?.trim() || null,
      isActive: payload.isActive,
      editDate: nowIso(),
    });
    return mockOk(updated, "Operative updated");
  },
  remove: async (id: number | string): Promise<ApiEnvelope<null>> => {
    await mockDelay();
    store.remove(id);
    return mockOk(null, "Operative deleted");
  },
};
