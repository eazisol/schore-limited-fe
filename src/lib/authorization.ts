import type { ApiMenu } from "@/lib/api/services/auth";

export type MenuAction = "read" | "modify" | "delete";

/** Paths that never require menu permissions (authenticated shell). */
export const PERMISSION_EXEMPT_PATHS = ["/forbidden", "/profile"] as const;

/** Unauthenticated / full-screen auth routes. */
export const PUBLIC_PATHS = ["/signin", "/forgot-password", "/reset-password"] as const;

export interface SettingsTab {
  to: string;
  label: string;
  code: string;
  orderBy: number;
  menu: ApiMenu;
}

/**
 * Map API menu routes onto this app's route tree.
 * Login returns `/dashboard` while the app serves the dashboard at `/`.
 */
export function toAppPath(apiRoute: string | null | undefined): string {
  const raw = (apiRoute ?? "").trim() || "/";
  const normalized = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;
  if (normalized === "/dashboard") return "/";
  return normalized;
}

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}

export function isPermissionExemptPath(pathname: string): boolean {
  return (PERMISSION_EXEMPT_PATHS as readonly string[]).includes(pathname);
}

function sortByOrder<T extends { orderBy: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.orderBy - b.orderBy);
}

function normalizeCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

/**
 * Maps a login menu to a Settings tab route when it belongs inside Settings
 * (not as a separate sidebar item). Returns null for non-settings-tab menus.
 */
export function resolveSettingsTabPath(menu: ApiMenu): string | null {
  const code = normalizeCode(menu.code);
  const route = (menu.route ?? "").trim().replace(/\/$/, "") || "/";

  const byCode: Record<string, string> = {
    ROLES: "/settings/roles",
    PERMISSIONS: "/settings/role-permissions",
    USER_TYPES: "/settings/user-types",
    USER_TYPE: "/settings/user-types",
    EMAIL_SMTP: "/settings/email-smtp",
    SMTP: "/settings/email-smtp",
    EMAIL: "/settings/email-smtp",
  };
  if (byCode[code]) return byCode[code];

  const byRoute: Record<string, string> = {
    "/roles": "/settings/roles",
    "/permissions": "/settings/role-permissions",
    "/user-types": "/settings/user-types",
    "/email-smtp": "/settings/email-smtp",
  };
  if (byRoute[route]) return byRoute[route];

  return null;
}

/** Menus that render as Settings tabs — never as separate sidebar items. */
export function isSettingsChildMenu(menu: ApiMenu): boolean {
  return resolveSettingsTabPath(menu) != null;
}

/** Whether a menu should appear in the main sidebar. */
export function isSidebarMenu(menu: ApiMenu): boolean {
  if (!menu.read) return false;
  if (isSettingsChildMenu(menu)) return false;
  return true;
}

/** Depth-first flatten of a menu tree. */
export function flattenMenus(menus: ApiMenu[]): ApiMenu[] {
  const out: ApiMenu[] = [];
  const walk = (items: ApiMenu[]) => {
    for (const item of sortByOrder(items)) {
      out.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(menus);
  return out;
}

/** Main sidebar menus: `read` only, excludes Settings child modules (Roles, Permissions, etc.). */
export function buildNavMenus(menus: ApiMenu[]): ApiMenu[] {
  const mapVisible = (items: ApiMenu[]): ApiMenu[] =>
    sortByOrder(items)
      .filter(isSidebarMenu)
      .map((m) => ({
        ...m,
        route: toAppPath(m.route),
        children: m.children?.length ? mapVisible(m.children) : [],
      }));
  return mapVisible(menus);
}

/**
 * Settings tabs derived from login menus.
 * - Dedicated menus (Roles, Permissions, …) become their own tab when `read` is true.
 * - User Types & Email SMTP fall under the Settings menu when no dedicated menu exists.
 */
export function buildSettingsTabs(menus: ApiMenu[]): SettingsTab[] {
  const flat = flattenMenus(menus);
  const tabs: SettingsTab[] = [];
  const seen = new Set<string>();

  for (const menu of flat) {
    if (!menu.read) continue;
    const tabPath = resolveSettingsTabPath(menu);
    if (!tabPath || seen.has(tabPath)) continue;
    seen.add(tabPath);
    tabs.push({
      to: tabPath,
      label: menu.name,
      code: menu.code,
      orderBy: menu.orderBy,
      menu,
    });
  }

  const settingsMenu = flat.find((m) => normalizeCode(m.code) === "SETTINGS" && m.read);
  if (settingsMenu) {
    const settingsDefaults: Array<{ path: string; label: string; orderBy: number }> = [
      { path: "/settings/user-types", label: "User Types", orderBy: settingsMenu.orderBy - 0.3 },
      { path: "/settings/email-smtp", label: "Email SMTP", orderBy: settingsMenu.orderBy + 0.3 },
    ];
    for (const def of settingsDefaults) {
      if (seen.has(def.path)) continue;
      seen.add(def.path);
      tabs.push({
        to: def.path,
        label: def.label,
        code: settingsMenu.code,
        orderBy: def.orderBy,
        menu: settingsMenu,
      });
    }
  }

  return sortByOrder(tabs);
}

export function hasSettingsAccess(menus: ApiMenu[]): boolean {
  const flat = flattenMenus(menus);
  if (flat.some((m) => normalizeCode(m.code) === "SETTINGS" && m.read)) return true;
  return buildSettingsTabs(menus).length > 0;
}

/**
 * Longest-prefix match of a pathname against menu routes (top-level pages).
 */
export function findMenuForPath(menus: ApiMenu[], pathname: string): ApiMenu | null {
  const path = toAppPath(pathname);
  const flat = flattenMenus(menus).map((m) => ({
    ...m,
    route: toAppPath(m.route),
  }));

  let best: ApiMenu | null = null;
  let bestLen = -1;

  for (const menu of flat) {
    const route = menu.route || "/";
    const matches =
      route === "/"
        ? path === "/"
        : path === route || path.startsWith(`${route}/`);
    if (!matches) continue;
    if (route.length > bestLen) {
      best = menu;
      bestLen = route.length;
    }
  }

  return best;
}

/** Resolve the login menu that governs permissions for an app pathname. */
export function resolveMenuForAppPath(menus: ApiMenu[], pathname: string): ApiMenu | null {
  const path = toAppPath(pathname);

  if (path.startsWith("/settings")) {
    const tabs = buildSettingsTabs(menus);
    const tab = tabs.find((t) => path === t.to || path.startsWith(`${t.to}/`));
    if (tab) return tab.menu;

    if (path === "/settings" || path === "/settings/") {
      const settingsMenu = findMenuByCode(menus, "SETTINGS");
      if (settingsMenu?.read) return settingsMenu;
      return tabs[0]?.menu ?? null;
    }

    return null;
  }

  return findMenuForPath(menus, path);
}

export function findMenuByCode(menus: ApiMenu[], code: string): ApiMenu | null {
  const needle = normalizeCode(code);
  return flattenMenus(menus).find((m) => normalizeCode(m.code) === needle) ?? null;
}

export function getMenuPermission(
  menus: ApiMenu[],
  action: MenuAction,
  opts: { code?: string; route?: string; pathname?: string },
): boolean {
  let menu: ApiMenu | null = null;

  if (opts.code) menu = findMenuByCode(menus, opts.code);
  else if (opts.pathname) menu = resolveMenuForAppPath(menus, opts.pathname);
  else if (opts.route) menu = resolveMenuForAppPath(menus, opts.route);

  if (!menu) return false;
  return Boolean(menu[action]);
}

/**
 * Whether the current pathname may be rendered.
 * - Public / exempt paths → allowed.
 * - Settings area → requires Settings access and tab-level `read`.
 * - Other paths → matching menu with `read`, or denied if unmatched.
 */
export function canAccessPath(menus: ApiMenu[], pathname: string): boolean {
  if (isPublicPath(pathname) || isPermissionExemptPath(pathname)) return true;

  const path = toAppPath(pathname);

  if (path === "/settings" || path === "/settings/") {
    return hasSettingsAccess(menus) && buildSettingsTabs(menus).length > 0;
  }

  if (path.startsWith("/settings/")) {
    if (!hasSettingsAccess(menus)) return false;
    const menu = resolveMenuForAppPath(menus, path);
    if (!menu) return false;
    return Boolean(menu.read);
  }

  const menu = resolveMenuForAppPath(menus, path);
  if (!menu) return false;
  return Boolean(menu.read);
}
