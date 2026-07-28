import type { ApiMenu } from "@/lib/api/services/auth";
import type { ApiMenuDefinition, MenuReorderItem } from "@/lib/api/services/menus";
import { reorderTreeSiblings } from "@/lib/tree-order";

function sortByOrder<T extends { orderBy: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.orderBy - b.orderBy);
}

function normalizeAppPath(route: string | null | undefined): string {
  const raw = (route ?? "").trim() || "/";
  const normalized = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;
  if (normalized === "/dashboard") return "/";
  if (normalized === "/product-management") return "/product";
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

/** Find a menu definition anywhere in a nested tree by id. */
export function findMenuDefinitionInTree(
  items: ApiMenuDefinition[],
  menuId: number,
): ApiMenuDefinition | null {
  for (const item of items) {
    if (item.id === menuId) return item;
    if (item.children?.length) {
      const found = findMenuDefinitionInTree(item.children, menuId);
      if (found) return found;
    }
  }
  return null;
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

function indexMenus(
  items: ApiMenuDefinition[],
  out = new Map<number, ApiMenuDefinition>(),
): Map<number, ApiMenuDefinition> {
  for (const item of items) {
    out.set(item.id, item);
    if (item.children?.length) indexMenus(item.children, out);
  }
  return out;
}

function toOrderable(menu: ApiMenuDefinition) {
  return {
    id: menu.id,
    parentMenuId: menu.parentMenuId,
    orderBy: menu.orderBy,
    children: (menu.children ?? []).map(toOrderable),
  };
}

function applyOrderableTree(
  orderable: ReturnType<typeof toOrderable>[],
  sourceById: Map<number, ApiMenuDefinition>,
): ApiMenuDefinition[] {
  const rebuild = (nodes: ReturnType<typeof toOrderable>[]): ApiMenuDefinition[] =>
    nodes.map((node) => {
      const original = sourceById.get(node.id);
      if (!original) {
        throw new Error(`Menu #${node.id} not found while applying reorder`);
      }
      return {
        ...original,
        orderBy: node.orderBy,
        children: node.children.length ? rebuild(node.children) : [],
      };
    });

  return rebuild(orderable);
}

/** Reorder siblings within a menu tree; only the dragged item's orderBy changes. */
export function reorderMenuDefinitionTree(
  tree: ApiMenuDefinition[],
  draggedId: number,
  targetId: number,
  parentMenuId: number | null,
): { tree: ApiMenuDefinition[]; orderBy: number } | null {
  const sourceById = indexMenus(tree);
  const orderable = tree.map(toOrderable);
  const result = reorderTreeSiblings(orderable, draggedId, targetId, parentMenuId);
  if (!result) return null;

  return {
    tree: applyOrderableTree(result.tree, sourceById),
    orderBy: result.orderBy,
  };
}

/** Flatten a nested menu tree into reorder API items (parents and children). */
export function flattenMenuTreeForReorder(tree: ApiMenuDefinition[]): MenuReorderItem[] {
  const out: MenuReorderItem[] = [];

  const walk = (nodes: ApiMenuDefinition[], parentMenuId: number | null) => {
    for (const node of nodes) {
      out.push({
        id: node.id,
        orderBy: node.orderBy,
        parentMenuId,
      });
      const children = node.children ?? [];
      if (children.length > 0) walk(children, node.id);
    }
  };

  walk(tree, null);
  return out;
}

/** True when every menu id, orderBy, and parentMenuId match between two trees. */
export function sameMenuTreeOrder(a: ApiMenuDefinition[], b: ApiMenuDefinition[]): boolean {
  const flatA = flattenMenuTreeForReorder(a);
  const flatB = flattenMenuTreeForReorder(b);
  if (flatA.length !== flatB.length) return false;

  const byId = new Map(flatA.map((item) => [item.id, item]));
  for (const item of flatB) {
    const other = byId.get(item.id);
    if (!other) return false;
    if (other.orderBy !== item.orderBy || other.parentMenuId !== item.parentMenuId) {
      return false;
    }
  }
  return true;
}

export function isPathActive(pathname: string, route: string | null | undefined): boolean {
  const path = normalizeAppPath(pathname);
  const to = normalizeAppPath(route);
  if (!to) return false;
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

/**
 * True when the pathname matches this menu or any descendant route.
 * Parent/container menus only follow children — their own route is ignored so an
 * empty API route (normalized to `/`) does not light up every section on Dashboard.
 */
export function isMenuTreeActive(pathname: string, menu: ApiMenu): boolean {
  const children = menu.children ?? [];
  if (children.length > 0) {
    return children.some((child) => isMenuTreeActive(pathname, child));
  }
  if (!menu.route) return false;
  return isPathActive(pathname, menu.route);
}

/** Parents with visible children act as expand/collapse containers (no navigation). */
export function isMenuContainer(menu: ApiMenu): boolean {
  return (menu.children?.length ?? 0) > 0;
}
