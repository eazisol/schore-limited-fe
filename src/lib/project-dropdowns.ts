import type { SearchableSelectOption } from "@/components/form";
import { projectsService } from "@/lib/api/services/projects";

const LOOKUP_PAGE_SIZE = 10;

export async function fetchProjectOptions(
  search: string,
  siteId?: string,
  customerId?: string,
): Promise<SearchableSelectOption[]> {
  const sid = siteId?.trim();
  const cid = customerId?.trim();
  const res = await projectsService.list({
    page: 1,
    pageSize: LOOKUP_PAGE_SIZE,
    search,
    ...(sid && Number.isFinite(Number(sid)) ? { siteId: Number(sid) } : {}),
    ...(cid && Number.isFinite(Number(cid)) ? { customerId: Number(cid) } : {}),
  });
  return (res.data.items ?? []).map((project) => ({
    value: String(project.id),
    label: `${project.code} · ${project.name}`,
  }));
}
