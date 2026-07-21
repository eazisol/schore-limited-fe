import type { ApiMenu } from "@/lib/api/services/auth";
import type { ApiMenuDefinition } from "@/lib/api/services/menus";

function sortByOrder<T extends { orderBy: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.orderBy - b.orderBy);
}

function normalizeAppPath(route: string | null | undefined): string {
  const raw = (route ?? "").trim() || "/";
  const normalized = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;
  if (normalized === "/dashboard") return "/";
  return normalized;
}

/** Flatten nested API menu definitions into a single list. */
export function flattenMenuDefinitions(items: ApiMenuDefinition[]): ApiMenuDefinition[] {
  const out: ApiMenuDefinition[] = [];
  const walk = (list: ApiMenuDefinition[]) => {
    for (const item of list) {
      const { children, ...rest } = item;
      out.push({ ...rest, children: undefined });
      if (children?.length) walk(children);
    }
  };
  walk(items);
  return out;
}

/**
 * Build a nested tree from a flat list using `parentMenuId`.
 * Orphan nodes (parent missing or filtered out) become roots.
 */
export function buildMenuTree(items: ApiMenuDefinition[]): ApiMenuDefinition[] {
  const nodes = new Map<number, ApiMenuDefinition & { children: ApiMenuDefinition[] }>();

  for (const item of items) {
    nodes.set(item.id, { ...item, children: [] });
  }

  const roots: (ApiMenuDefinition & { children: ApiMenuDefinition[] })[] = [];

  for (const node of nodes.values()) {
    const parentId = node.parentMenuId;
    if (parentId != null && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (list: ApiMenuDefinition[]): ApiMenuDefinition[] =>
    sortByOrder(list).map((node) => ({
      ...node,
      children: node.children?.length ? sortTree(node.children) : [],
    }));

  return sortTree(roots);
}

export function isPathActive(pathname: string, route: string | null | undefined): boolean {
  const path = normalizeAppPath(pathname);
  const to = normalizeAppPath(route);
  if (!to) return false;
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

/** True when the pathname matches this menu or any descendant route. */
export function isMenuTreeActive(pathname: string, menu: ApiMenu): boolean {
  if (menu.route && isPathActive(pathname, menu.route)) return true;
  return (menu.children ?? []).some((child) => isMenuTreeActive(pathname, child));
}

/** Parents with visible children act as expand/collapse containers (no navigation). */
export function isMenuContainer(menu: ApiMenu): boolean {
  return (menu.children?.length ?? 0) > 0;
}
