import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ChevronRight, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TreeSortableDragHandle,
  TreeSortableItem,
  TreeSortableLevel,
  TreeSortableProvider,
} from "@/components/tree-sortable";
import { useMenuTreeReorder } from "@/hooks/useMenuTreeReorder";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lookupsService, type ApiRole } from "@/lib/api/services/lookups";
import { menusService } from "@/lib/api/services/menus";
import {
  permissionsService,
  type UpsertPermission,
} from "@/lib/api/services/permissions";
import { notifyApiError } from "@/lib/api/axios";
import { Can, usePermission } from "@/components/Permission";
import {
  PERMISSION_UPDATED_STORAGE_KEY,
  usePermissions,
} from "@/contexts/PermissionContext";
import { PERMISSIONS_ROUTE } from "@/lib/permissions-route";
import { cn } from "@/lib/utils";
import {
  buildPermissionTree,
  collectExpandableMenuIds,
  findPermissionNode,
  flattenTreeForSave,
  isDescendantLocked,
  mergePermissions,
  samePermissionTree,
  setPermissionFlag,
  type PermissionFlag,
  type PermissionTreeNode,
} from "@/lib/permission-tree";

export const Route = createFileRoute("/permissions")({
  head: () => ({ meta: [{ title: "Permissions | Schore" }] }),
  component: PermissionsPage,
});

function PermissionsPage() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: PERMISSIONS_ROUTE, action: "modify" });
  const { refreshPermissions } = usePermissions();
  const [roleId, setRoleId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PermissionTreeNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  // Reuse the shared ["roles"] cache from User Management — do not use a different key.
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await lookupsService.roles()).data ?? [],
  });

  const menusQuery = useQuery({
    queryKey: ["menus", "tree"],
    queryFn: async () => (await menusService.tree()).data ?? [],
    staleTime: 60_000,
  });

  const roles = rolesQuery.data ?? [];

  useEffect(() => {
    if (roleId != null || roles.length === 0) return;
    const firstActive = roles.find((r: ApiRole) => r.isActive) ?? roles[0];
    if (firstActive) setRoleId(firstActive.id);
  }, [roles, roleId]);

  const permsQuery = useQuery({
    queryKey: ["permissions", "role", roleId],
    queryFn: async () => (await permissionsService.getByRole(roleId!)).data ?? [],
    enabled: roleId != null,
    refetchOnWindowFocus: false,
  });

  const serverTree = useMemo(() => {
    if (!menusQuery.isSuccess || !permsQuery.isSuccess || permsQuery.data == null) {
      return [] as PermissionTreeNode[];
    }
    return mergePermissions(
      buildPermissionTree(menusQuery.data ?? []),
      permsQuery.data,
    );
  }, [menusQuery.isSuccess, menusQuery.data, permsQuery.isSuccess, permsQuery.data]);

  useEffect(() => {
    setDraft([]);
    setExpandedIds(new Set());
  }, [roleId]);

  useEffect(() => {
    if (serverTree.length === 0) return;
    setDraft(serverTree);
    setExpandedIds(new Set(collectExpandableMenuIds(serverTree)));
  }, [serverTree]);

  const isDirty = draft.length > 0 && !samePermissionTree(draft, serverTree);

  const saveMutation = useMutation({
    mutationFn: (payload: { roleId: number; permissions: UpsertPermission[] }) =>
      permissionsService.assign(payload),
    onSuccess: async (res, vars) => {
      toast.success(res.message || "Permissions saved");
      const next = res.data ?? [];
      qc.setQueryData(["permissions", "role", vars.roleId], next);
      const merged = mergePermissions(
        buildPermissionTree(menusQuery.data ?? []),
        next,
      );
      setDraft(merged);
      try {
        window.localStorage.setItem(PERMISSION_UPDATED_STORAGE_KEY, String(Date.now()));
      } catch {
        // Cross-tab refresh is best-effort; the current tab still refreshes below.
      }
      try {
        await refreshPermissions();
      } catch (err) {
        notifyApiError(err, "Permissions saved, but authorization could not be refreshed");
      }
    },
    onError: (err) => notifyApiError(err, "Failed to save permissions"),
  });

  const canReorderMenus = canModify && !saveMutation.isPending;
  const { reorderMenus, isReordering } = useMenuTreeReorder({ enabled: canReorderMenus });

  function toggle(menuId: number, flag: PermissionFlag) {
    setDraft((prev) => {
      const node = findPermissionNode(prev, menuId);
      if (!node) return prev;
      return setPermissionFlag(prev, menuId, flag, !node[flag]);
    });
  }

  function handleSave() {
    if (roleId == null || !isDirty || saveMutation.isPending) return;
    saveMutation.mutate({
      roleId,
      permissions: flattenTreeForSave(draft),
    });
  }

  function toggleExpanded(menuId: number, open: boolean) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(menuId);
      else next.delete(menuId);
      return next;
    });
  }

  const loadingTree =
    menusQuery.isLoading ||
    permsQuery.isLoading ||
    ((menusQuery.isFetching || permsQuery.isFetching) && draft.length === 0);

  const loadError = menusQuery.isError || permsQuery.isError;
  const showTree = roleId != null && draft.length > 0 && !loadingTree && !loadError;
  const saving = saveMutation.isPending || isReordering;

  return (
    <div className="space-y-6">
      <PageHeader title="Permissions" />

      <div className="card-elevated p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full space-y-2 sm:w-64">
            <label htmlFor="permissions-role" className="text-xs font-medium text-muted-foreground">
              Role
            </label>
            {rolesQuery.isLoading ? (
              <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
              </div>
            ) : rolesQuery.isError ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-destructive">Unable to load roles</p>
                <Button variant="outline" size="sm" onClick={() => rolesQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles available.</p>
            ) : (
              <Select
                value={roleId != null ? String(roleId) : undefined}
                onValueChange={(v) => setRoleId(Number(v))}
                disabled={saving}
              >
                <SelectTrigger id="permissions-role" className="bg-background">
                  <SelectValue placeholder="Select a role…" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r: ApiRole) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                      {!r.isActive ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Can route={PERMISSIONS_ROUTE} action="modify">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving || roleId == null || draft.length === 0}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save permissions"}
            </Button>
          </Can>
        </div>
      </div>

      {roleId == null ? (
        <div className="card-elevated p-12 text-center text-sm text-muted-foreground">
          Select a role to manage its permissions.
        </div>
      ) : loadingTree ? (
        <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Loading permissions…
        </div>
      ) : loadError ? (
        <div className="card-elevated p-12 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
          <div className="text-sm font-medium">Unable to load permissions</div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              void menusQuery.refetch();
              void permsQuery.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : !showTree ? (
        <div className="card-elevated p-12 text-center text-sm text-muted-foreground">
          No permissions found for this role.
        </div>
      ) : (
        <div className="card-elevated overflow-x-auto">
          <div className="grid min-w-[36rem] grid-cols-[minmax(0,1fr)_6rem_6rem_6rem] gap-0 border-b bg-muted/50 text-xs text-muted-foreground">
            <div className="px-5 py-2.5 font-medium">Menu</div>
            <div className="px-3 py-2.5 text-center font-medium">Read</div>
            <div className="px-3 py-2.5 text-center font-medium">Modify</div>
            <div className="px-3 py-2.5 text-center font-medium">Delete</div>
          </div>
          <TreeSortableProvider
            disabled={!canReorderMenus}
            onReorder={reorderMenus}
            renderOverlay={(activeId) => {
              const activeNode = findPermissionNode(draft, activeId);
              return (
                <div className="grid min-w-[36rem] grid-cols-[minmax(0,1fr)_6rem_6rem_6rem] items-center rounded-md border bg-card px-5 py-3 shadow-lg">
                  <div className="truncate text-xs font-medium text-foreground">
                    {activeNode?.menuName ?? `Menu #${activeId}`}
                  </div>
                </div>
              );
            }}
          >
            <TreeSortableLevel items={draft.map((node) => node.menuId)}>
              <div className="divide-y">
                {draft.map((node) => (
                  <PermissionTreeRow
                    key={node.menuId}
                    node={node}
                    depth={0}
                    tree={draft}
                    expandedIds={expandedIds}
                    onToggleExpanded={toggleExpanded}
                    onToggleFlag={toggle}
                    canModify={canModify}
                    canReorder={canReorderMenus}
                    saving={saving}
                  />
                ))}
              </div>
            </TreeSortableLevel>
          </TreeSortableProvider>
        </div>
      )}
    </div>
  );
}

function PermissionTreeRow({
  node,
  depth,
  tree,
  expandedIds,
  onToggleExpanded,
  onToggleFlag,
  canModify,
  canReorder,
  saving,
}: {
  node: PermissionTreeNode;
  depth: number;
  tree: PermissionTreeNode[];
  expandedIds: Set<number>;
  onToggleExpanded: (menuId: number, open: boolean) => void;
  onToggleFlag: (menuId: number, flag: PermissionFlag) => void;
  canModify: boolean;
  canReorder: boolean;
  saving: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const open = expandedIds.has(node.menuId);
  const lockedByAncestor = isDescendantLocked(tree, node.menuId);
  const baseDisabled = saving || !canModify || lockedByAncestor;
  const modifyDeleteDisabled = baseDisabled || !node.read;

  const rowContent = (dragHandleProps: ComponentProps<typeof TreeSortableDragHandle>["dragHandleProps"]) => (
    <div
      className={cn(
        "grid min-w-[36rem] grid-cols-[minmax(0,1fr)_6rem_6rem_6rem] items-center hover:bg-muted/30",
        depth === 0 && hasChildren && "bg-muted/10",
      )}
    >
      <div
        className="flex min-w-0 items-center gap-1.5 px-5 py-3"
        style={{ paddingLeft: `${1.25 + depth * 1.25}rem` }}
      >
        <TreeSortableDragHandle
          label={node.menuName}
          dragHandleProps={dragHandleProps}
          disabled={!canReorder}
        />
        {hasChildren ? (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={open ? `Collapse ${node.menuName}` : `Expand ${node.menuName}`}
            >
              <ChevronRight
                className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
              />
            </button>
          </CollapsibleTrigger>
        ) : (
          <span className="inline-flex h-6 w-6 shrink-0" aria-hidden />
        )}
        <div
          className={cn(
            "min-w-0 truncate text-xs font-medium text-muted-foreground",
            hasChildren && "text-foreground/90",
          )}
          title={node.menuName}
        >
          {node.menuName}
        </div>
      </div>
      {(["read", "modify", "delete"] as const).map((flag) => (
        <div key={flag} className="px-3 py-3 text-center">
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

  const sortableRow = (
    <TreeSortableItem
      id={node.menuId}
      parentMenuId={node.parentMenuId}
      disabled={!canReorder}
    >
      {({ dragHandleProps }) => rowContent(dragHandleProps)}
    </TreeSortableItem>
  );

  if (!hasChildren) {
    return sortableRow;
  }

  return (
    <Collapsible open={open} onOpenChange={(next) => onToggleExpanded(node.menuId, next)}>
      {sortableRow}
      <CollapsibleContent>
        <TreeSortableLevel items={node.children.map((child) => child.menuId)}>
          {node.children.map((child) => (
            <PermissionTreeRow
              key={child.menuId}
              node={child}
              depth={depth + 1}
              tree={tree}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              onToggleFlag={onToggleFlag}
              canModify={canModify}
              canReorder={canReorder}
              saving={saving}
            />
          ))}
        </TreeSortableLevel>
      </CollapsibleContent>
    </Collapsible>
  );
}
