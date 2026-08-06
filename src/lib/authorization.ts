import type { ApiMenu } from "@/lib/api/services/auth";
import type { ApiMenuDefinition } from "@/lib/api/services/menus";
import type { ApiPermission } from "@/lib/api/services/permissions";
import { buildMenuTree, flattenMenuDefinitions } from "@/lib/menu-tree";

export type MenuAction = "read" | "modify" | "delete";

/** Paths that never require menu permissions (authenticated shell). */
export const PERMISSION_EXEMPT_PATHS = ["/forbidden", "/profile"] as const;

/** Unauthenticated / full-screen auth routes. */
export const PUBLIC_PATHS = ["/signin", "/forgot-password", "/reset-password"] as const;

/** Build one authorized menu tree by unioning grants from every assigned role. */
export function buildAuthorizedMenus(
  menuTree: ApiMenuDefinition[],
  rolePermissions: ApiPermission[][],
): ApiMenu[] {
  const grants = new Map<number, Pick<ApiMenu, "read" | "modify" | "delete">>();

  for (const permission of rolePermissions.flat()) {
    const current = grants.get(permission.menuId);
    grants.set(permission.menuId, {
      read: Boolean(current?.read || permission.read),
      modify: Boolean(current?.modify || permission.modify),
      delete: Boolean(current?.delete || permission.delete),
    });
  }

  const mapMenus = (items: ApiMenuDefinition[]): ApiMenu[] =>
    sortByOrder(items)
      .filter((menu) => menu.isActive)
      .reduce<ApiMenu[]>((acc, menu) => {
        const sourceChildren = menu.children ?? [];
        const children = mapMenus(sourceChildren);
        // Parent with defined children: hide when every child is inactive (or pruned).
        if (sourceChildren.length > 0 && children.length === 0) {
          return acc;
        }
        const permission = grants.get(menu.id);
        acc.push({
          id: menu.id,
          name: menu.name?.trim() || `Menu ${menu.id}`,
          code: menu.code?.trim() || "",
          route: menu.route?.trim() || "",
          icon: menu.icon,
          parentMenuId: menu.parentMenuId,
          orderBy: menu.orderBy,
          read: permission?.read ?? false,
          modify: permission?.modify ?? false,
          delete: permission?.delete ?? false,
          children,
        });
        return acc;
      }, []);

  const flatDefinitions = flattenMenuDefinitions(menuTree);
  const treeDefinitions = buildMenuTree(flatDefinitions);

  return mapMenus(treeDefinitions);
}

/**
 * Map API menu routes onto this app's route tree.
 * Login returns `/dashboard` while the app serves the dashboard at `/`.
 */
export function toAppPath(apiRoute: string | null | undefined): string {
  const raw = (apiRoute ?? "").trim() || "/";
  const normalized = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;
  if (normalized === "/dashboard") return "/";
  if (normalized === "/product-management") return "/product";
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

/** Whether a menu should appear in the main sidebar. */
export function isSidebarMenu(menu: ApiMenu): boolean {
  return Boolean(menu.read);
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

/** Rebuild sidebar tree from visible flat menus using `parentMenuId`. */
function rebuildSidebarTree(flat: ApiMenu[]): ApiMenu[] {
  const visible = flat.filter(isSidebarMenu);
  const visibleIds = new Set(visible.map((menu) => menu.id));
  const nodes = new Map<number, ApiMenu & { children: ApiMenu[] }>();

  for (const menu of visible) {
    nodes.set(menu.id, {
      ...menu,
      route: toAppPath(menu.route),
      children: [],
    });
  }

  const roots: (ApiMenu & { children: ApiMenu[] })[] = [];

  for (const node of nodes.values()) {
    const parentId = node.parentMenuId;
    if (parentId != null && visibleIds.has(parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (items: (ApiMenu & { children: ApiMenu[] })[]): ApiMenu[] =>
    sortByOrder(items).map((item) => ({
      ...item,
      children: item.children.length ? sortTree(item.children) : [],
    }));

  return sortTree(roots);
}

/** Main sidebar menus: `read` only, nested via Menu API `parentMenuId`. */
export function buildNavMenus(menus: ApiMenu[]): ApiMenu[] {
  return rebuildSidebarTree(flattenMenus(menus));
}

/** Readable child menus of a parent (by code), for container redirects. */
export function getChildMenusByParentCode(menus: ApiMenu[], parentCode: string): ApiMenu[] {
  const flat = flattenMenus(menus);
  const parent = flat.find((m) => normalizeCode(m.code) === normalizeCode(parentCode));
  if (!parent) return [];
  return sortByOrder(flat.filter((m) => m.parentMenuId === parent.id && m.read)).map((m) => ({
    ...m,
    route: toAppPath(m.route),
  }));
}

/** Readable child menus of Settings (by `parentMenuId`), for redirects. */
export function getSettingsChildMenus(menus: ApiMenu[]): ApiMenu[] {
  return getChildMenusByParentCode(menus, "SETTINGS");
}

export function hasSettingsAccess(menus: ApiMenu[]): boolean {
  const flat = flattenMenus(menus);
  if (flat.some((m) => normalizeCode(m.code) === "SETTINGS" && m.read)) return true;
  return getSettingsChildMenus(menus).length > 0;
}

/** Readable child menus of Product (by `parentMenuId`), for redirects. */
export function getProductChildMenus(menus: ApiMenu[]): ApiMenu[] {
  const byProduct = getChildMenusByParentCode(menus, "PRODUCT");
  if (byProduct.length) return byProduct;
  return getChildMenusByParentCode(menus, "PRODUCT_MANAGEMENT");
}

export function hasProductAccess(menus: ApiMenu[]): boolean {
  const flat = flattenMenus(menus);
  if (
    flat.some(
      (m) =>
        (normalizeCode(m.code) === "PRODUCT" || normalizeCode(m.code) === "PRODUCT_MANAGEMENT") &&
        m.read,
    )
  ) {
    return true;
  }
  return getProductChildMenus(menus).length > 0;
}

/**
 * Longest-prefix match of a pathname against menu routes.
 * On equal route length, prefer a leaf (no children) so a parent container
 * sharing a route with its page (e.g. Roles parent + ROLE_LIST both `/roles`)
 * does not steal page-level permission checks.
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
      continue;
    }
    if (route.length === bestLen && best) {
      const bestIsLeaf = (best.children?.length ?? 0) === 0;
      const menuIsLeaf = (menu.children?.length ?? 0) === 0;
      if (menuIsLeaf && !bestIsLeaf) best = menu;
    }
  }

  return best;
}

/** Resolve the login menu that governs permissions for an app pathname. */
export function resolveMenuForAppPath(menus: ApiMenu[], pathname: string): ApiMenu | null {
  return findMenuForPath(menus, pathname);
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

  // Tasks menu may be inactive (hidden from sidebar); allow via Daily Programme.
  if (!menu && isTasksAppPath(opts.pathname ?? opts.route)) {
    menu = findMenuByCode(menus, "DAILY") ?? resolveMenuForAppPath(menus, "/daily");
  }

  if (!menu) return false;
  return Boolean(menu[action]);
}

function isTasksAppPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const normalized = toAppPath(path);
  return normalized === "/tasks" || normalized.startsWith("/tasks/");
}

/**
 * Whether the current pathname may be rendered.
 * - Public / exempt paths → allowed.
 * - Other paths → matching menu with `read`, or denied if unmatched.
 */
export function canAccessPath(menus: ApiMenu[], pathname: string): boolean {
  if (isPublicPath(pathname) || isPermissionExemptPath(pathname)) return true;

  const path = toAppPath(pathname);

  if (path === "/settings" || path === "/settings/") {
    return hasSettingsAccess(menus);
  }

  if (
    path === "/product" ||
    path === "/product/" ||
    path === "/product-management" ||
    path === "/product-management/"
  ) {
    return hasProductAccess(menus);
  }

  // Tasks list/create/edit: when Tasks menu is inactive, Daily Programme grants access.
  if (isTasksAppPath(path)) {
    const tasksMenu = resolveMenuForAppPath(menus, "/tasks") ?? findMenuByCode(menus, "TASKS");
    if (tasksMenu) return Boolean(tasksMenu.read);
    const dailyMenu = resolveMenuForAppPath(menus, "/daily") ?? findMenuByCode(menus, "DAILY");
    return Boolean(dailyMenu?.read);
  }

  const menu = resolveMenuForAppPath(menus, path);
  if (!menu) return false;
  return Boolean(menu.read);
}
