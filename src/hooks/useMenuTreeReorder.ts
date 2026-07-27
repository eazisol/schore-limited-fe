import { useQueryClient } from "@tanstack/react-query";
import type { ApiMenuDefinition } from "@/lib/api/services/menus";
import { reorderMenuDefinitionTree } from "@/lib/menu-tree";
import type { TreeReorderPayload } from "@/components/tree-sortable";

const MENUS_TREE_QUERY_KEY = ["menus", "tree"] as const;

/**
 * Local-only menu reorder for the Permissions page.
 * API integration will be added when the dedicated reorder endpoint is available.
 */
export function useMenuTreeReorder({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const queryClient = useQueryClient();

  function reorderMenus(payload: TreeReorderPayload) {
    if (!enabled) return;

    const currentMenus = queryClient.getQueryData<ApiMenuDefinition[]>(MENUS_TREE_QUERY_KEY);
    if (!currentMenus?.length) return;

    const result = reorderMenuDefinitionTree(
      currentMenus,
      payload.draggedId,
      payload.targetId,
      payload.parentMenuId,
    );
    if (!result) return;

    queryClient.setQueryData(MENUS_TREE_QUERY_KEY, result.tree);
  }

  return {
    reorderMenus,
    isReordering: false,
  };
}
