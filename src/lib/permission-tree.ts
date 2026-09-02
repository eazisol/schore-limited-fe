import type { ApiMenuDefinition } from "@/lib/api/services/menus";
import type { ApiPermission, UpsertPermission } from "@/lib/api/services/permissions";
import { buildMenuTree, flattenMenuDefinitions } from "@/lib/menu-tree";

export type PermissionFlag = "read" | "modify" | "delete";

export type PermissionFlags = {
  read: boolean;
  modify: boolean;
  delete: boolean;
};

export type PermissionTreeNode = {
  menuId: string;
  menuName: string;
  menuCode: string;
  parentMenuId: string | null;
  orderBy: number;
  read: boolean;
  modify: boolean;
  delete: boolean;
  children: PermissionTreeNode[];
};

function cloneNode(node: PermissionTreeNode): PermissionTreeNode {
  return {
    ...node,
    children: node.children.map(cloneNode),
  };
}

export function clonePermissionTree(tree: PermissionTreeNode[]): PermissionTreeNode[] {
  return tree.map(cloneNode);
}

function mapMenuToNode(menu: ApiMenuDefinition): PermissionTreeNode {
  return {
    menuId: menu.id,
    menuName: menu.name?.trim() || menu.code?.trim() || `Menu #${menu.id}`,
    menuCode: menu.code?.trim() || "",
    parentMenuId: menu.parentMenuId,
    orderBy: menu.orderBy,
    read: false,
    modify: false,
    delete: false,
    children: (menu.children ?? []).map(mapMenuToNode),
  };
}

/** Menu definitions → nested permission nodes (flags default false). */
export function buildPermissionTree(menuTree: ApiMenuDefinition[]): PermissionTreeNode[] {
  const flat = flattenMenuDefinitions(menuTree);
  const nested = buildMenuTree(flat);
  return nested.map(mapMenuToNode);
}

function applyFlags(node: PermissionTreeNode, flags: PermissionFlags): PermissionTreeNode {
  return {
    ...node,
    read: flags.read,
    modify: flags.modify,
    delete: flags.delete,
  };
}

function findAndApply(
  nodes: PermissionTreeNode[],
  menuId: string,
  updater: (node: PermissionTreeNode) => PermissionTreeNode,
): { tree: PermissionTreeNode[]; found: boolean } {
  let found = false;
  const tree = nodes.map((node) => {
    if (node.menuId === menuId) {
      found = true;
      return updater(node);
    }
    if (node.children.length === 0) return node;
    const childResult = findAndApply(node.children, menuId, updater);
    if (childResult.found) {
      found = true;
      return { ...node, children: childResult.tree };
    }
    return node;
  });
  return { tree, found };
}

function collectMenuIds(nodes: PermissionTreeNode[], out = new Set<string>()): Set<string> {
  for (const node of nodes) {
    out.add(node.menuId);
    if (node.children.length) collectMenuIds(node.children, out);
  }
  return out;
}

/**
 * Map menuId → flags onto the tree.
 * Orphan permissions (no matching menu) become root-level leaves.
 */
export function mergePermissions(
  tree: PermissionTreeNode[],
  flatPerms: ApiPermission[],
): PermissionTreeNode[] {
  const byId = new Map<string, PermissionFlags>();
  for (const perm of flatPerms) {
    byId.set(perm.menuId, {
      read: Boolean(perm.read),
      modify: Boolean(perm.modify),
      delete: Boolean(perm.delete),
    });
  }

  const apply = (nodes: PermissionTreeNode[]): PermissionTreeNode[] =>
    nodes.map((node) => {
      const flags = byId.get(node.menuId);
      const next = flags ? applyFlags(node, flags) : node;
      return {
        ...next,
        // Rule 4/5: modify/delete require read
        modify: next.read ? next.modify : false,
        delete: next.read ? next.delete : false,
        children: apply(node.children),
      };
    });

  let merged = apply(clonePermissionTree(tree));
  const knownIds = collectMenuIds(merged);

  const orphans: PermissionTreeNode[] = [];
  for (const perm of flatPerms) {
    if (knownIds.has(perm.menuId)) continue;
    orphans.push({
      menuId: perm.menuId,
      menuName: perm.menuName?.trim() || perm.menuCode?.trim() || `Menu #${perm.menuId}`,
      menuCode: perm.menuCode?.trim() || "",
      parentMenuId: null,
      orderBy: Number.MAX_SAFE_INTEGER,
      read: Boolean(perm.read),
      modify: Boolean(perm.read) && Boolean(perm.modify),
      delete: Boolean(perm.read) && Boolean(perm.delete),
      children: [],
    });
  }

  if (orphans.length) {
    merged = [...merged, ...orphans];
  }

  // Normalize parent reads from children (Rules 2–3) after merge
  return normalizeParentReads(merged);
}

/** Recursive: apply flags to every descendant. */
export function updateChildrenPermissions(
  node: PermissionTreeNode,
  flags: PermissionFlags,
): PermissionTreeNode {
  return {
    ...applyFlags(node, flags),
    children: node.children.map((child) => updateChildrenPermissions(child, flags)),
  };
}

/** Recompute parent.read from children (Rules 2–3), walking up from menuId. */
export function updateParentPermissions(
  tree: PermissionTreeNode[],
  menuId: string,
): PermissionTreeNode[] {
  const path = findPath(tree, menuId);
  if (!path || path.length < 2) return tree;

  // path[0] is root ancestor, path[path.length-1] is the node itself
  // Recompute from nearest parent up to root
  let next = clonePermissionTree(tree);
  for (let i = path.length - 2; i >= 0; i--) {
    const parentId = path[i].menuId;
    next = recomputeParentRead(next, parentId);
  }
  return next;
}

function findPath(
  nodes: PermissionTreeNode[],
  menuId: string,
  trail: PermissionTreeNode[] = [],
): PermissionTreeNode[] | null {
  for (const node of nodes) {
    const nextTrail = [...trail, node];
    if (node.menuId === menuId) return nextTrail;
    const found = findPath(node.children, menuId, nextTrail);
    if (found) return found;
  }
  return null;
}

function recomputeParentRead(
  tree: PermissionTreeNode[],
  parentId: string,
): PermissionTreeNode[] {
  const { tree: next } = findAndApply(tree, parentId, (parent) => {
    if (parent.children.length === 0) return parent;

    const anyChildRead = parent.children.some((c) => c.read);
    const allChildrenUnread = parent.children.every((c) => !c.read);

    let read = parent.read;
    if (anyChildRead) {
      read = true; // Rule 3
    } else if (allChildrenUnread) {
      read = false; // Rule 2
    }

    if (!read) {
      // Rule 5 on parent; Rule 1 already satisfied (children are unread)
      return { ...parent, read: false, modify: false, delete: false };
    }

    return { ...parent, read: true };
  });
  return next;
}

/** After merge/load: Rule 3 — any child read forces parent read true. */
function normalizeParentReads(tree: PermissionTreeNode[]): PermissionTreeNode[] {
  const normalize = (nodes: PermissionTreeNode[]): PermissionTreeNode[] =>
    nodes.map((node) => {
      const children = normalize(node.children);
      if (children.length === 0) {
        return { ...node, children };
      }
      const anyChildRead = children.some((c) => c.read);
      const read = anyChildRead ? true : node.read;
      return {
        ...node,
        children,
        read,
        modify: read ? node.modify : false,
        delete: read ? node.delete : false,
      };
    });
  return normalize(tree);
}

/**
 * Single entrypoint applying cascade Rules 1–5.
 * Returns a new tree.
 */
export function setPermissionFlag(
  tree: PermissionTreeNode[],
  menuId: string,
  flag: PermissionFlag,
  value: boolean,
): PermissionTreeNode[] {
  let next = clonePermissionTree(tree);

  const { tree: updated, found } = findAndApply(next, menuId, (node) => {
    if (flag === "read") {
      if (!value) {
        // Rules 1 & 5: clear self modify/delete and all descendants
        return updateChildrenPermissions(node, {
          read: false,
          modify: false,
          delete: false,
        });
      }
      // read = true: keep children as-is; clear modify/delete only if they lacked read before N/A
      return { ...node, read: true };
    }

    // Rules 4–5: modify/delete require read
    if (!node.read) {
      return { ...node, modify: false, delete: false };
    }
    if (!value) {
      return { ...node, [flag]: false };
    }
    return { ...node, [flag]: true };
  });

  if (!found) return tree;
  next = updated;

  // Child change → recompute ancestors (Rules 2–3)
  next = updateParentPermissions(next, menuId);

  // If a parent was forced to read=false by Rule 2, ensure descendants stay cleared (Rule 1)
  next = enforceAncestorReadLocks(next);

  return next;
}

/** Any node under an unread parent must be fully cleared (Rule 1). */
function enforceAncestorReadLocks(tree: PermissionTreeNode[]): PermissionTreeNode[] {
  const walk = (nodes: PermissionTreeNode[], ancestorRead: boolean): PermissionTreeNode[] =>
    nodes.map((node) => {
      if (!ancestorRead) {
        return updateChildrenPermissions(node, {
          read: false,
          modify: false,
          delete: false,
        });
      }
      const self = {
        ...node,
        modify: node.read ? node.modify : false,
        delete: node.read ? node.delete : false,
      };
      return {
        ...self,
        children: walk(self.children, self.read),
      };
    });
  return walk(tree, true);
}

/** True when any ancestor of menuId has read === false. */
export function isDescendantLocked(tree: PermissionTreeNode[], menuId: string): boolean {
  const path = findPath(tree, menuId);
  if (!path || path.length < 2) return false;
  // Ancestors are all but the last node
  return path.slice(0, -1).some((ancestor) => !ancestor.read);
}

export function findPermissionNode(
  tree: PermissionTreeNode[],
  menuId: string,
): PermissionTreeNode | null {
  const path = findPath(tree, menuId);
  return path?.[path.length - 1] ?? null;
}

/** DFS → flat payload for Permissions/assign. */
export function flattenTreeForSave(tree: PermissionTreeNode[]): UpsertPermission[] {
  const out: UpsertPermission[] = [];
  const walk = (nodes: PermissionTreeNode[]) => {
    for (const node of nodes) {
      out.push({
        menuId: node.menuId,
        read: node.read,
        modify: node.modify,
        delete: node.delete,
      });
      if (node.children.length) walk(node.children);
    }
  };
  walk(tree);
  return out;
}

export function samePermissionTree(
  a: PermissionTreeNode[],
  b: PermissionTreeNode[],
): boolean {
  const flatA = flattenTreeForSave(a);
  const flatB = flattenTreeForSave(b);
  if (flatA.length !== flatB.length) return false;
  for (let i = 0; i < flatA.length; i++) {
    const x = flatA[i];
    const y = flatB[i];
    if (
      x.menuId !== y.menuId ||
      x.read !== y.read ||
      x.modify !== y.modify ||
      x.delete !== y.delete
    ) {
      return false;
    }
  }
  return true;
}

/** Collect menuIds that have children (for default expanded state). */
export function collectExpandableMenuIds(tree: PermissionTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: PermissionTreeNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        ids.push(node.menuId);
        walk(node.children);
      }
    }
  };
  walk(tree);
  return ids;
}
