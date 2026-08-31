import type { SearchableSelectOption } from "@/components/form";
import { usersService } from "@/lib/api/services/users";
import { tradesService } from "@/lib/api/services/trades";
import { cisService } from "@/lib/api/services/cis";
import { USER_TYPE_ID } from "@/lib/user-module";
import { formatCisRate } from "@/lib/module-ui";

const LOOKUP_PAGE_SIZE = 10;

export async function fetchCustomerOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await usersService.dropdown({
    search,
    userTypeId: USER_TYPE_ID.customer,
    take: LOOKUP_PAGE_SIZE,
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
    take: LOOKUP_PAGE_SIZE,
  });
  return (res.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
}

export async function fetchTradeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await tradesService.list({
    page: 1,
    pageSize: LOOKUP_PAGE_SIZE,
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

export async function fetchCisOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await cisService.list({
    page: 1,
    pageSize: LOOKUP_PAGE_SIZE,
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
