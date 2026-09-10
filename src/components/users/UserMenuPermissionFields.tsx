import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormFieldHint } from "@/components/form/FormFieldLabel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { menusService } from "@/lib/api/services/menus";
import { permissionsService } from "@/lib/api/services/permissions";
import type { UserFormValues } from "@/lib/user-form";
import { isCeoRole } from "@/lib/user-capabilities";
import {
  buildPermissionTree,
  collectExpandableMenuIds,
  findPermissionNode,
  flattenTreeForSave,
  isDescendantLocked,
  mergePermissions,
  setPermissionFlag,
  type PermissionFlag,
  type PermissionTreeNode,
} from "@/lib/permission-tree";
import {
  diffMenuOverrides,
  flattenRoleTree,
  sameMenuOverrides,
  toOverridePermissions,
} from "@/lib/user-menu-permissions";
import { cn } from "@/lib/utils";

const permissionGridClass = "grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem]";

export function UserMenuPermissionFields({
  disabled = false,
  resetKey,
}: {
  disabled?: boolean;
  resetKey?: string;
}) {
  const { control, setValue } = useFormContext<UserFormValues>();
  const roleId = useWatch({ control, name: "roleId" })?.trim() ?? "";
  const overrides = useWatch({ control, name: "menuPermissionOverrides" }) ?? [];
  const appliedRoleIdRef = useRef<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    appliedRoleIdRef.current = null;
  }, [resetKey]);

  const menusQuery = useQuery({
    queryKey: ["menus", "tree"],
    queryFn: async () => (await menusService.tree()).data ?? [],
    staleTime: 60_000,
  });

  const catalogQuery = useQuery({
    queryKey: ["users", "menu-permission-catalog", roleId],
    queryFn: async () => (await permissionsService.getCatalogByRole(roleId)).data,
    enabled: Boolean(roleId),
  });

  const ceo = isCeoRole(catalogQuery.data?.roleCode);
  const catalogReady = Boolean(roleId) && catalogQuery.data?.roleId === roleId;
  const roleItems = catalogQuery.data?.permissions ?? [];

  const roleTree = useMemo(() => {
    if (!menusQuery.data?.length) return [];
    return mergePermissions(buildPermissionTree(menusQuery.data), roleItems);
  }, [menusQuery.data, roleItems]);

  const tree = useMemo(() => {
    if (roleTree.length === 0) return [];
    if (overrides.length === 0) return roleTree;
    return mergePermissions(roleTree, toOverridePermissions(overrides));
  }, [overrides, roleTree]);

  useEffect(() => {
    if (tree.length === 0) return;
    setExpandedIds(new Set(collectExpandableMenuIds(tree)));
  }, [roleId, tree.length]);

  useEffect(() => {
    if (!catalogReady || !roleId || roleTree.length === 0) return;

    if (ceo) {
      appliedRoleIdRef.current = roleId;
      if (overrides.length === 0) return;
      setValue("menuPermissionOverrides", [], { shouldDirty: true, shouldTouch: true });
      return;
    }

    if (appliedRoleIdRef.current === roleId) return;
    const isFirstCatalog = appliedRoleIdRef.current == null;
    appliedRoleIdRef.current = roleId;
    if (isFirstCatalog) return;

    const next = diffMenuOverrides(flattenTreeForSave(tree), flattenRoleTree(roleTree));
    if (sameMenuOverrides(overrides, next)) return;
    setValue("menuPermissionOverrides", next, { shouldDirty: true, shouldTouch: true });
  }, [catalogReady, ceo, overrides, roleId, roleTree, setValue, tree]);

  function toggle(menuId: string, flag: PermissionFlag) {
    const node = findPermissionNode(tree, menuId);
    if (!node) return;
    const nextTree = setPermissionFlag(tree, menuId, flag, !node[flag]);
    setValue("menuPermissionOverrides", diffMenuOverrides(flattenTreeForSave(nextTree), flattenRoleTree(roleTree)), {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function resetToRole() {
    if (overrides.length === 0) return;
    setValue("menuPermissionOverrides", [], { shouldDirty: true, shouldTouch: true });
  }

  if (!roleId) {
    return (
      <p className="text-xs text-muted-foreground">Select a role to set menu access.</p>
    );
  }

  if (menusQuery.isLoading || catalogQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading menu access…
      </div>
    );
  }

  if (menusQuery.isError || catalogQuery.isError) {
    return <p className="text-xs text-destructive">Unable to load menu permissions for this role.</p>;
  }

  return (
    <div className="space-y-2">
      {!ceo && overrides.length > 0 ? (
        <div className="flex items-center justify-end pb-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={resetToRole}
            disabled={disabled}
          >
            Reset to role
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-md border">
        <div className={cn(permissionGridClass, "border-b bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground")}>
          <div className="px-4 py-2">Menu</div>
          <div className="px-2 py-2 text-center">R</div>
          <div className="px-2 py-2 text-center">M</div>
          <div className="px-2 py-2 text-center">D</div>
        </div>
        <div className="divide-y">
          {tree.map((node) => (
            <MenuPermissionRow
              key={node.menuId}
              node={node}
              depth={0}
              tree={tree}
              expandedIds={expandedIds}
              disabled={disabled || ceo}
              onToggleExpanded={(menuId, open) => {
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (open) next.add(menuId);
                  else next.delete(menuId);
                  return next;
                });
              }}
              onToggleFlag={toggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuPermissionRow({
  node,
  depth,
  tree,
  expandedIds,
  disabled,
  onToggleExpanded,
  onToggleFlag,
}: {
  node: PermissionTreeNode;
  depth: number;
  tree: PermissionTreeNode[];
  expandedIds: Set<string>;
  disabled: boolean;
  onToggleExpanded: (menuId: string, open: boolean) => void;
  onToggleFlag: (menuId: string, flag: PermissionFlag) => void;
}) {
  const hasChildren = node.children.length > 0;
  const open = expandedIds.has(node.menuId);
  const lockedByAncestor = isDescendantLocked(tree, node.menuId);
  const baseDisabled = disabled || lockedByAncestor;
  const modifyDeleteDisabled = baseDisabled || !node.read;

  const row = (
    <div
      className={cn(
        permissionGridClass,
        "items-center",
        depth === 0 && hasChildren && "bg-muted/10",
      )}
    >
      <div
        className="flex min-w-0 items-center gap-1 px-4 py-2"
        style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
      >
        {hasChildren ? (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={open ? `Collapse ${node.menuName}` : `Expand ${node.menuName}`}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
            </button>
          </CollapsibleTrigger>
        ) : (
          <span className="inline-flex h-6 w-6 shrink-0" aria-hidden />
        )}
        <div className={cn("min-w-0 truncate text-xs font-medium", hasChildren && "text-foreground/90")} title={node.menuName}>
          {node.menuName}
        </div>
      </div>
      {(["read", "modify", "delete"] as const).map((flag) => (
        <div key={flag} className="px-2 py-2 text-center">
          <div className="inline-flex justify-center">
            <Checkbox
              checked={node[flag]}
              disabled={flag === "read" ? baseDisabled : modifyDeleteDisabled}
              onCheckedChange={() => onToggleFlag(node.menuId, flag)}
              aria-label={`${node.menuName} ${flag}`}
            />
          </div>
        </div>
      ))}
    </div>
  );

  if (!hasChildren) return row;

  return (
    <Collapsible open={open} onOpenChange={(next) => onToggleExpanded(node.menuId, next)}>
      {row}
      <CollapsibleContent>
        {node.children.map((child) => (
          <MenuPermissionRow
            key={child.menuId}
            node={child}
            depth={depth + 1}
            tree={tree}
            expandedIds={expandedIds}
            disabled={disabled}
            onToggleExpanded={onToggleExpanded}
            onToggleFlag={onToggleFlag}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
