import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

/** Artificial latency so UI loading states behave like a real API. */
export function mockDelay(ms = 280): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockOk<T>(data: T, message = "OK"): ApiEnvelope<T> {
  return { success: true, message, data };
}

export function mockFail(message: string, status = 400): never {
  const err = Object.assign(new Error(message), {
    status,
    message,
    isNetworkError: false,
    toasted: false,
    original: null,
  });
  throw err;
}

export type MockListParams = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

type StoreOptions<T extends { id: number }> = {
  seed: T[];
  /** Fields concatenated for free-text search. */
  getSearchText: (item: T) => string;
  /** Optional extra filter (e.g. status / category). */
  matchesFilter?: (item: T, params: MockListParams & Record<string, unknown>) => boolean;
  /** Column id → comparator (ascending). */
  sorters?: Record<string, (a: T, b: T) => number>;
  defaultSortBy?: string;
};

/**
 * In-memory CRUD store with server-style pagination/search/sort.
 * Swap each feature service to real `http` calls later without changing UI.
 */
export function createMockStore<T extends { id: number }>(options: StoreOptions<T>) {
  let items = structuredClone(options.seed);
  let nextId = Math.max(0, ...items.map((i) => i.id)) + 1;

  function list(params: MockListParams & Record<string, unknown>): PagedResult<T> {
    const search = (params.search ?? "").trim().toLowerCase();
    let filtered = items.filter((item) => {
      if (search) {
        const hay = options.getSearchText(item).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (options.matchesFilter && !options.matchesFilter(item, params)) return false;
      return true;
    });

    const sortBy = params.sortBy || options.defaultSortBy;
    const sortDir = params.sortDir === "desc" ? "desc" : "asc";
    if (sortBy && options.sorters?.[sortBy]) {
      const cmp = options.sorters[sortBy];
      filtered = [...filtered].sort((a, b) => {
        const result = cmp(a, b);
        return sortDir === "desc" ? -result : result;
      });
    }

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, params.pageSize || 10);
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    return {
      items: structuredClone(pageItems),
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  function get(id: number | string): T {
    const numericId = Number(id);
    const found = items.find((i) => i.id === numericId);
    if (!found) mockFail("Record not found", 404);
    return structuredClone(found);
  }

  function create(payload: Omit<T, "id">): T {
    const row = { ...payload, id: nextId++ } as T;
    items = [row, ...items];
    return structuredClone(row);
  }

  function update(id: number | string, payload: Partial<T>): T {
    const numericId = Number(id);
    const index = items.findIndex((i) => i.id === numericId);
    if (index < 0) mockFail("Record not found", 404);
    const next = { ...items[index], ...payload, id: numericId } as T;
    items = [...items.slice(0, index), next, ...items.slice(index + 1)];
    return structuredClone(next);
  }

  function remove(id: number | string): void {
    const numericId = Number(id);
    const before = items.length;
    items = items.filter((i) => i.id !== numericId);
    if (items.length === before) mockFail("Record not found", 404);
  }

  function all(): T[] {
    return structuredClone(items);
  }

  return { list, get, create, update, remove, all };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function compareString(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function compareNumber(a: number, b: number): number {
  return a - b;
}

export function compareBool(a: boolean, b: boolean): number {
  return Number(a) - Number(b);
}
