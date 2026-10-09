import type { ApiMenu } from "@/lib/api/services/auth";
import type { ApiMenuDefinition } from "@/lib/api/services/menus";
import { findMenuByCode } from "@/lib/authorization";
import { buildMenuTree, flattenMenuDefinitions } from "@/lib/menu-tree";

export const OPERATIVE_USER_TYPE_CODE = "OPERATIVE";
export const OPERATIVE_HOME_MENU_CODE = "OPERATIVE_HOME";
export const OPERATIVE_HOME_PATH = "/operatives/me";
/** Portal menus for OPERATIVE users (wages deliberately omitted — not shown on login). */
export const OPERATIVE_PORTAL_MENU_CODES = [OPERATIVE_HOME_MENU_CODE] as const;

export function isOperativeUserType(code: string | null | undefined): boolean {
  return (code ?? "").trim().toUpperCase() === OPERATIVE_USER_TYPE_CODE;
}

/** Operative portal: UserType OPERATIVE — self dashboard (not a Role). */
export function isOperativePortalUser(
  userTypeCode: string | null | undefined,
  menus: ApiMenu[] = [],
): boolean {
  if (isOperativeUserType(userTypeCode)) return true;
  return Boolean(findMenuByCode(menus, OPERATIVE_HOME_MENU_CODE)?.read);
}

export function operativeHomePathFromMenus(menus: ApiMenu[]): string {
  const home = findMenuByCode(menus, OPERATIVE_HOME_MENU_CODE);
  if (home?.read) return OPERATIVE_HOME_PATH;
  return "/";
}

/** Hide Wages from nav / path access for OPERATIVE user type (frontend). */
export function stripOperativeWagesMenus(menus: ApiMenu[]): ApiMenu[] {
  const strip = (items: ApiMenu[]): ApiMenu[] =>
    items
      .filter((m) => (m.code ?? "").trim().toUpperCase() !== "WAGES")
      .map((m) => ({
        ...m,
        children: m.children?.length ? strip(m.children) : m.children,
      }));
  return strip(menus);
}

/** When OPERATIVE has no roles, grant Read on portal menus from the menu tree. */
export function buildOperativePortalMenus(menuTree: ApiMenuDefinition[]): ApiMenu[] {
  const flat = flattenMenuDefinitions(menuTree);
  const tree = buildMenuTree(flat);
  const allowed = new Set(
    OPERATIVE_PORTAL_MENU_CODES.map((c) => c.toUpperCase()),
  );

  const mapMenus = (items: ApiMenuDefinition[]): ApiMenu[] =>
    items
      .filter((m) => m.isActive)
      .reduce<ApiMenu[]>((acc, menu) => {
        const children = mapMenus(menu.children ?? []);
        const code = (menu.code ?? "").trim().toUpperCase();
        const isPortal = allowed.has(code);
        if (!isPortal && children.length === 0) return acc;
        acc.push({
          id: menu.id,
          name: menu.name?.trim() || `Menu ${menu.id}`,
          code: menu.code?.trim() || "",
          route: menu.route?.trim() || "",
          icon: menu.icon,
          parentMenuId: menu.parentMenuId,
          orderBy: menu.orderBy,
          read: isPortal,
          modify: false,
          delete: false,
          children,
        });
        return acc;
      }, [])
      .sort((a, b) => a.orderBy - b.orderBy);

  return mapMenus(tree).filter((m) => m.read || (m.children?.length ?? 0) > 0);
}
