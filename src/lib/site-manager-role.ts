import { lookupsService } from "@/lib/api/services/lookups";

let cachedSiteManagerRoleId: number | null | undefined;

/** Resolve the Site Manager role id (code `SM`) from the roles lookup. */
export async function getSiteManagerRoleId(): Promise<number | null> {
  if (cachedSiteManagerRoleId !== undefined) return cachedSiteManagerRoleId;
  const roles = (await lookupsService.roles()).data ?? [];
  const sm = roles.find((role) => role.code === "SM" && role.isActive !== false);
  cachedSiteManagerRoleId = sm?.id ?? null;
  return cachedSiteManagerRoleId;
}
