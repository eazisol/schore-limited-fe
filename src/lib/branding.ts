import { useQuery } from "@tanstack/react-query";
import type { ApiMenu } from "@/lib/api/services/auth";
import { settingsService } from "@/lib/api/services/settings";

/** Legacy route — redirects to Manage Forms Branding tab. */
export const BRANDING_ROUTE = "/branding";

/** Legacy menu code (stripped if still present from an old seed). */
export const BRANDING_CODE = "BRANDING";

/** React Query key for company branding (wage sheet, shell, etc.). */
export const brandingQueryKey = ["settings", "branding"] as const;

/** Shared branding fetch for sidebar logo, wage sheet, etc. */
export function useCompanyBranding() {
  return useQuery({
    queryKey: brandingQueryKey,
    queryFn: async () => (await settingsService.getBranding()).data ?? null,
    staleTime: 60_000,
  });
}

function normalizeCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

/** Drop any API Branding node (legacy seed) from the tree. */
export function stripBrandingMenu(menus: ApiMenu[]): ApiMenu[] {
  const strip = (items: ApiMenu[]): ApiMenu[] =>
    items
      .filter((menu) => normalizeCode(menu.code) !== BRANDING_CODE)
      .map((menu) => ({
        ...menu,
        children: menu.children?.length ? strip(menu.children) : menu.children,
      }));

  return strip(menus);
}
