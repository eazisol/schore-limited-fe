import type { SearchableSelectOption } from "@/components/form";
import { usersService } from "@/lib/api/services/users";
import { tradesService } from "@/lib/api/services/trades";
import { cisService } from "@/lib/api/services/cis";
import { rolesService } from "@/lib/api/services/system-config";
import { DROPDOWN_FETCH_SIZE } from "@/lib/dropdown-fetch";
import { USER_TYPE_ID } from "@/lib/user-module";
import { formatCisRate } from "@/lib/module-ui";
import { parseAssignableStaffLabel } from "@/lib/project-assignee";

export async function fetchCustomerOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await usersService.dropdown({
    search,
    userTypeId: USER_TYPE_ID.customer,
    take: DROPDOWN_FETCH_SIZE,
  });
  return (res.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
}

export async function fetchContractorOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await usersService.dropdown({
    search,
    userTypeId: USER_TYPE_ID.contractor,
    take: DROPDOWN_FETCH_SIZE,
  });
  return (res.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
}

export async function fetchTradeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await tradesService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    sortBy: "name",
    sortDir: "asc",
  });
  return (res.data.items ?? [])
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || `Trade ${row.id}`,
    }));
}

export async function fetchRoleOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await rolesService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    sortBy: "name",
    sortDir: "asc",
  });
  return (res.data?.items ?? [])
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || `Role ${row.id}`,
      description: row.description?.trim() || undefined,
    }));
}

export async function fetchCisOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await cisService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    sortBy: "name",
    sortDir: "asc",
  });
  return (res.data.items ?? [])
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      value: String(row.id),
      label: `${row.name?.trim() || `CIS ${row.id}`} (${formatCisRate(row.rate)})`,
    }));
}

const PROJECT_ASSIGNABLE_ROLE_CODES = "CM,PM,SM";

export async function fetchProjectAssigneeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await usersService.dropdown({
    search,
    userTypeId: USER_TYPE_ID.user,
    roleCodes: PROJECT_ASSIGNABLE_ROLE_CODES,
    take: DROPDOWN_FETCH_SIZE,
  });
  return (res.data ?? []).map((item) => {
    const parsed = parseAssignableStaffLabel(item.name ?? "");
    return {
      value: String(item.id),
      label: parsed.label || item.name,
      code: parsed.code,
    };
  });
}
