import type { SearchableSelectOption } from "@/components/form";
import { projectsService } from "@/lib/api/services/projects";
import { DROPDOWN_FETCH_SIZE } from "@/lib/dropdown-fetch";
import { asIdString, isNonEmptyId } from "@/lib/ids";

export async function fetchProjectOptions(
  search: string,
  siteId?: string,
  customerId?: string,
): Promise<SearchableSelectOption[]> {
  const sid = asIdString(siteId);
  const cid = asIdString(customerId);
  const res = await projectsService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
    ...(isNonEmptyId(sid) ? { siteId: sid } : {}),
    ...(isNonEmptyId(cid) ? { customerId: cid } : {}),
  });
  return (res.data.items ?? []).map((project) => ({
    value: String(project.id),
    label: `${project.code} · ${project.name}`,
  }));
}
