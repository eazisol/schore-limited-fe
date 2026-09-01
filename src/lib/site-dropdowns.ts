import type { SearchableSelectOption } from "@/components/form";
import { sitesService } from "@/lib/api/services/sites";

const LOOKUP_PAGE_SIZE = 10;

export async function fetchSiteOptions(
  search: string,
  customerId?: string,
): Promise<SearchableSelectOption[]> {
  const cid = customerId?.trim();
  const res = await sitesService.list({
    page: 1,
    pageSize: LOOKUP_PAGE_SIZE,
    search,
    ...(cid && Number.isFinite(Number(cid)) ? { customerId: Number(cid) } : {}),
  });
  return (res.data.items ?? []).map((site) => ({
    value: String(site.id),
    label: `${site.code} · ${site.name}`,
  }));
}
