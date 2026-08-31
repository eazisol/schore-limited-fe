import type { SearchableSelectOption } from "@/components/form";
import { productsService } from "@/lib/api/services/products";
import { tradesService } from "@/lib/api/services/trades";

export async function fetchTradeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await tradesService.list({
    page: 1,
    pageSize: 10,
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
    pageSize: 10,
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
