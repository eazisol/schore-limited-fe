import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiMenuDefinition } from "@/lib/api/services/menus";
import {
  flattenMenuTreeForReorder,
  reorderMenuDefinitionTree,
  sameMenuTreeOrder,
} from "@/lib/menu-tree";
import type { TreeReorderPayload } from "@/components/tree-sortable";

export const MENUS_TREE_QUERY_KEY = ["menus", "tree"] as const;

/**
 * Local menu reorder state for the Permissions page.
 * Drag updates are kept in memory until Save Order calls the API.
 */
export function useMenuTreeReorder({
  enabled = true,
  menus,
  onTreeChange,
}: {
  enabled?: boolean;
  menus: ApiMenuDefinition[] | undefined;
  onTreeChange?: (tree: ApiMenuDefinition[]) => void;
}) {
  const queryClient = useQueryClient();
  const baselineRef = useRef<ApiMenuDefinition[]>([]);
  const [menuTreeDraft, setMenuTreeDraft] = useState<ApiMenuDefinition[]>([]);
  const [baselineVersion, setBaselineVersion] = useState(0);

  useEffect(() => {
    if (!menus?.length) {
      baselineRef.current = [];
      setMenuTreeDraft([]);
      return;
    }

    setMenuTreeDraft((current) => {
      const hasPendingChanges =
        current.length > 0 && !sameMenuTreeOrder(current, baselineRef.current);
      if (hasPendingChanges) return current;

      baselineRef.current = menus;
      return menus;
    });
  }, [menus]);

  const isOrderDirty = useMemo(() => {
    if (menuTreeDraft.length === 0 || baselineRef.current.length === 0) return false;
    return !sameMenuTreeOrder(menuTreeDraft, baselineRef.current);
    // baselineVersion bumps after save so isOrderDirty recomputes
  }, [menuTreeDraft, baselineVersion]);

  const reorderMenus = useCallback(
    (payload: TreeReorderPayload) => {
      if (!enabled) return;

      const currentMenus =
        menuTreeDraft.length > 0 ? menuTreeDraft : baselineRef.current;
      if (!currentMenus.length) return;

      const result = reorderMenuDefinitionTree(
        currentMenus,
        payload.draggedId,
        payload.targetId,
        payload.parentMenuId,
      );
      if (!result) return;

      setMenuTreeDraft(result.tree);
      onTreeChange?.(result.tree);
    },
    [enabled, menuTreeDraft, onTreeChange],
  );

  const buildReorderPayload = useCallback(() => {
    return { items: flattenMenuTreeForReorder(menuTreeDraft) };
  }, [menuTreeDraft]);

  const commitBaseline = useCallback(
    (tree: ApiMenuDefinition[]) => {
      baselineRef.current = tree;
      setMenuTreeDraft(tree);
      queryClient.setQueryData(MENUS_TREE_QUERY_KEY, tree);
      setBaselineVersion((v) => v + 1);
    },
    [queryClient],
  );

  const resetToBaseline = useCallback(() => {
    const baseline = baselineRef.current;
    setMenuTreeDraft(baseline);
    onTreeChange?.(baseline);
    setBaselineVersion((v) => v + 1);
  }, [onTreeChange]);

  return {
    menuTreeDraft,
    reorderMenus,
    isOrderDirty,
    buildReorderPayload,
    commitBaseline,
    resetToBaseline,
  };
}
