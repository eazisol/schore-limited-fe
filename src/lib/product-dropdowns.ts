import type { SearchableSelectOption } from "@/components/form";
import { productsService } from "@/lib/api/services/products";
import { tradesService } from "@/lib/api/services/trades";
import { DROPDOWN_FETCH_SIZE } from "@/lib/dropdown-fetch";

export async function fetchTradeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await tradesService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    sortBy: "name",
    sortDir: "asc",
  });
  return (res.data.items ?? [])
    .filter((row) => row.isActive)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || `Trade ${row.id}`,
    }));
}

export async function fetchProductOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await productsService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    sortBy: "name",
    sortDir: "asc",
  });
  return (res.data.items ?? [])
    .filter((row) => row.isActive)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || row.sku || `Product ${row.id}`,
    }));
}
