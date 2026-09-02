import type { SearchableSelectOption } from "@/components/form";
import { sitesService } from "@/lib/api/services/sites";
import { DROPDOWN_FETCH_SIZE } from "@/lib/dropdown-fetch";
import { asIdString, isNonEmptyId } from "@/lib/ids";

export async function fetchSiteOptions(
  search: string,
  customerId?: string,
): Promise<SearchableSelectOption[]> {
  const cid = asIdString(customerId);
  const res = await sitesService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    ...(isNonEmptyId(cid) ? { customerId: cid } : {}),
  });
  return (res.data.items ?? []).map((site) => ({
    value: String(site.id),
    label: `${site.code} · ${site.name}`,
  }));
}
