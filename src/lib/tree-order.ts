import { arrayMove } from "@dnd-kit/sortable";

export type OrderableTreeNode = {
  id: number;
  parentMenuId: number | null;
  orderBy: number;
  children: OrderableTreeNode[];
};

export function getSiblingList<T extends OrderableTreeNode>(
  tree: T[],
  parentMenuId: number | null,
): T[] | null {
  if (parentMenuId === null) return tree;
  for (const node of tree) {
    if (node.id === parentMenuId) return node.children as T[];
    if (node.children.length > 0) {
      const found = getSiblingList(node.children as T[], parentMenuId);
      if (found) return found;
    }
  }
  return null;
}

export function canReorderSiblings(
  draggedParentMenuId: number | null,
  targetParentMenuId: number | null,
): boolean {
  return draggedParentMenuId === targetParentMenuId;
}

/**
 * Reorder siblings visually and renumber every sibling's orderBy to match
 * the new list order (1-based). Parent relationships are never changed.
 */
export function computeSiblingReorder<T extends OrderableTreeNode>(
  siblings: T[],
  draggedId: number,
  targetId: number,
): { siblings: T[]; orderBy: number } | null {
  if (draggedId === targetId) return null;

  const oldIndex = siblings.findIndex((item) => item.id === draggedId);
  const newIndex = siblings.findIndex((item) => item.id === targetId);
  if (oldIndex === -1 || newIndex === -1) return null;

  const reordered = arrayMove(siblings, oldIndex, newIndex);
  const siblingsNext = reordered.map((item, index) => ({
    ...item,
    orderBy: index + 1,
  }));

  return {
    siblings: siblingsNext,
    orderBy: siblingsNext.find((item) => item.id === draggedId)?.orderBy ?? newIndex + 1,
  };
}

function replaceSiblingList<T extends OrderableTreeNode>(
  tree: T[],
  parentMenuId: number | null,
  nextSiblings: T[],
): T[] {
  if (parentMenuId === null) return nextSiblings;

  return tree.map((node) => {
    if (node.id === parentMenuId) {
      return { ...node, children: nextSiblings };
    }
    if (node.children.length === 0) return node;
    return {
      ...node,
      children: replaceSiblingList(node.children as T[], parentMenuId, nextSiblings),
    };
  });
}

/** Apply a sibling reorder within a nested tree. Returns null when invalid. */
export function reorderTreeSiblings<T extends OrderableTreeNode>(
  tree: T[],
  draggedId: number,
  targetId: number,
  parentMenuId: number | null,
): { tree: T[]; orderBy: number } | null {
  const siblings = getSiblingList(tree, parentMenuId);
  if (!siblings) return null;

  const result = computeSiblingReorder(siblings, draggedId, targetId);
  if (!result) return null;

  return {
    tree: replaceSiblingList(tree, parentMenuId, result.siblings),
    orderBy: result.orderBy,
  };
}
