import type { SearchableSelectOption } from "@/components/form";
import { propertiesService } from "@/lib/api/services/properties";
import { jobTypesService } from "@/lib/api/services/job-types";
import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import { tradesService } from "@/lib/api/services/trades";
import { tradeGroupsService } from "@/lib/api/services/trade-groups";
import { productsService } from "@/lib/api/services/products";
import { usersService } from "@/lib/api/services/users";
import { tasksService } from "@/lib/api/services/tasks";
import { DROPDOWN_FETCH_SIZE } from "@/lib/dropdown-fetch";
import { USER_TYPE_ID } from "@/lib/user-module";

function toOptions(
  rows: { id: number; name?: string | null; isActive?: boolean }[],
): SearchableSelectOption[] {
  return rows
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || `Option ${row.id}`,
    }));
}

export async function fetchPropertyOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await propertiesService.list({ page: 1, pageSize: DROPDOWN_FETCH_SIZE, search });
  return (res.data.items ?? []).map((p) => ({
    value: String(p.id),
    label: p.propertyName?.trim() || `Property ${p.id}`,
  }));
}

export async function fetchJobTypeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await jobTypesService.list({ page: 1, pageSize: DROPDOWN_FETCH_SIZE, search });
  return toOptions(res.data.items ?? []);
}

export async function fetchTaskStatusOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await statusesService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    documentTypeCode: DOCUMENT_TYPE_CODE.TASK,
  });
  return (res.data.items ?? [])
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || `Option ${row.id}`,
      code: row.code,
    }));
}

/** Synthetic filter value — not a Task Status row. */
export const DAILY_OVERDUE_STATUS_FILTER = "overdue";

/** Daily Programmer status filter: real task statuses + synthetic Overdue. */
export async function fetchDailyStatusFilterOptions(
  search: string,
): Promise<SearchableSelectOption[]> {
  const options = await fetchTaskStatusOptions(search);
  const q = search.trim().toLowerCase();
  const overdueMatches =
    !q || "overdue".includes(q) || "overdue".startsWith(q);
  if (!overdueMatches) return options;
  return [
    {
      value: DAILY_OVERDUE_STATUS_FILTER,
      label: "Overdue",
      code: "OVERDUE",
    },
    ...options,
  ];
}

export async function fetchTaskItemStatusOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await statusesService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    documentTypeCode: DOCUMENT_TYPE_CODE.TASK_ITEM,
  });
  return toOptions(res.data.items ?? []);
}

export async function fetchSiteManagerOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await usersService.dropdown({
    search,
    userTypeId: USER_TYPE_ID.user,
    roleCodes: "SM",
    take: DROPDOWN_FETCH_SIZE,
  });
  return (res.data ?? []).map((u) => ({
    value: String(u.id),
    label: u.name,
  }));
}

export async function fetchOperativeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await usersService.dropdown({
    search,
    userTypeId: USER_TYPE_ID.operative,
    take: DROPDOWN_FETCH_SIZE,
  });
  return (res.data ?? []).map((u) => ({
    value: String(u.id),
    label: u.name,
  }));
}

export async function fetchTradeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await tradesService.list({ page: 1, pageSize: DROPDOWN_FETCH_SIZE, search });
  return toOptions((res.data.items ?? []).map((t) => ({ id: t.id, name: t.name, isActive: t.isActive })));
}

export async function fetchTradeGroupOptions(
  tradeId: number,
  search: string,
): Promise<SearchableSelectOption[]> {
  const res = await tradeGroupsService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    ...(tradeId > 0 ? { tradeId } : {}),
  });
  return toOptions(
    (res.data.items ?? []).map((g) => ({ id: g.id, name: g.name, isActive: g.isActive })),
  );
}

/** Full package catalogue — not filtered by operative trade (SRS: trade is not a lock). */
export async function fetchPackageOptions(search: string): Promise<SearchableSelectOption[]> {
  return fetchTradeGroupOptions(0, search);
}

export async function fetchProductOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await productsService.list({ page: 1, pageSize: DROPDOWN_FETCH_SIZE, search });
  return toOptions(
    (res.data.items ?? []).map((p) => ({ id: p.id, name: p.name, isActive: p.isActive })),
  );
}

const PACKAGE_VALUE_PREFIX = "pkg:";
const ADDON_VALUE_PREFIX = "addon:";

/** Combined package + add-on list for a single job-item picker. */
export async function fetchPackageOrAddonOptions(
  search: string,
): Promise<SearchableSelectOption[]> {
  const [packages, products] = await Promise.all([
    fetchPackageOptions(search),
    fetchProductOptions(search),
  ]);
  return [
    ...packages.map((row) => ({
      value: `${PACKAGE_VALUE_PREFIX}${row.value}`,
      label: row.label,
      group: "Packages",
    })),
    ...products.map((row) => ({
      value: `${ADDON_VALUE_PREFIX}${row.value}`,
      label: row.label,
      group: "Add-ons",
    })),
  ];
}

export function parsePackageOrAddonValue(
  value: string,
): { kind: "tradeGroup" | "product"; id: string } | null {
  const raw = value.trim();
  if (raw.startsWith(PACKAGE_VALUE_PREFIX)) {
    const id = raw.slice(PACKAGE_VALUE_PREFIX.length);
    return id ? { kind: "tradeGroup", id } : null;
  }
  if (raw.startsWith(ADDON_VALUE_PREFIX)) {
    const id = raw.slice(ADDON_VALUE_PREFIX.length);
    return id ? { kind: "product", id } : null;
  }
  return null;
}

export function packageOrAddonSelectionValue(
  kind: "tradeGroup" | "product",
  id: string,
): string {
  if (!id) return "";
  return kind === "tradeGroup"
    ? `${PACKAGE_VALUE_PREFIX}${id}`
    : `${ADDON_VALUE_PREFIX}${id}`;
}

export async function fetchTimeSlotOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await tasksService.timeSlots();
  const q = search.trim().toLowerCase();
  return (res.data ?? [])
    .filter((t) => t.isActive !== false)
    .filter((t) => !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q))
    .map((t) => ({
      value: String(t.id),
      label: t.name,
      code: t.code,
    }));
}
