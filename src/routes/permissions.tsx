import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, ChevronRight, Info, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TreeSortableDragHandle,
  TreeSortableItem,
  TreeSortableLevel,
  TreeSortableProvider,
} from "@/components/tree-sortable";
import { useMenuTreeReorder } from "@/hooks/useMenuTreeReorder";
import type { ApiMenuDefinition } from "@/lib/api/services/menus";
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
import { capabilitiesService, type ApiCapabilityDefinition } from "@/lib/api/services/access";
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
import { flattenMenuTreeForReorder } from "@/lib/menu-tree";
import { z } from "zod";

const searchSchema = z.object({
  roleId: z.string().optional(),
  from: z.enum(["roles"]).optional(),
});

const permissionGridClass = "grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem]";

export const Route = createFileRoute("/permissions")({
  head: () => ({ meta: [{ title: "Permissions | Schore" }] }),
  validateSearch: searchSchema,
  component: PermissionsPage,
});

function PermissionsPage() {
  const { roleId: roleIdFromSearch, from } = Route.useSearch();
  const fromRoles = from === "roles";
  const qc = useQueryClient();
  const canModify = usePermission({ route: PERMISSIONS_ROUTE, action: "modify" });
  const { refreshPermissions } = usePermissions();
  const [roleId, setRoleId] = useState<string | null>(roleIdFromSearch ?? null);
  const [draft, setDraft] = useState<PermissionTreeNode[]>([]);
  const [capabilityDraft, setCapabilityDraft] = useState<ApiCapabilityDefinition[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [confirmSaveOrder, setConfirmSaveOrder] = useState(false);

  const handleMenuTreeChange = useCallback((tree: Parameters<typeof buildPermissionTree>[0]) => {
    setDraft((prev) =>
      mergePermissions(buildPermissionTree(tree), flattenTreeForSave(prev)),
    );
  }, []);

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
    if (roleIdFromSearch != null) {
      setRoleId(roleIdFromSearch);
    }
  }, [roleIdFromSearch]);

  useEffect(() => {
    if (roleId != null || roles.length === 0) return;
    const firstActive = roles.find((r: ApiRole) => r.isActive) ?? roles[0];
    if (firstActive) setRoleId(firstActive.id);
  }, [roles, roleId]);

  const capQuery = useQuery({
    queryKey: ["permissions", "capabilities", "role", roleId],
    queryFn: async () => (await capabilitiesService.getByRole(roleId!)).data,
    enabled: roleId != null,
    refetchOnWindowFocus: false,
  });

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

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      roleId: string;
      permissions: UpsertPermission[];
      capabilities: { code: string; isGranted: boolean }[];
      saveMenus: boolean;
      saveCapabilities: boolean;
    }) => {
      const [menusRes, capRes] = await Promise.all([
        payload.saveMenus
          ? permissionsService.assign({
              roleId: payload.roleId,
              permissions: payload.permissions,
            })
          : Promise.resolve(null),
        payload.saveCapabilities
          ? capabilitiesService.assignForRole(payload.roleId, payload.capabilities)
          : Promise.resolve(null),
      ]);
      return { menusRes, capRes, roleId: payload.roleId };
    },
    onSuccess: async (res) => {
      toast.success("Permissions saved");
      if (res.menusRes) {
        const next = res.menusRes.data ?? [];
        qc.setQueryData(["permissions", "role", res.roleId], next);
        const merged = mergePermissions(
          buildPermissionTree(menusQuery.data ?? []),
          next,
        );
        setDraft(merged);
      }
      if (res.capRes?.data) {
        qc.setQueryData(["permissions", "capabilities", "role", res.roleId], res.capRes.data);
        setCapabilityDraft(res.capRes.data.capabilities ?? []);
      }
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

  const {
    menuTreeDraft,
    reorderMenus,
    isOrderDirty,
    commitBaseline,
    resetToBaseline,
  } = useMenuTreeReorder({
    enabled: canModify && !saveMutation.isPending,
    menus: menusQuery.data,
    onTreeChange: handleMenuTreeChange,
  });

  const saveOrderMutation = useMutation({
    mutationFn: (tree: ApiMenuDefinition[]) =>
      menusService.reorder({ items: flattenMenuTreeForReorder(tree) }),
    onSuccess: async (res, tree) => {
      toast.success(res.message || "Menu order saved");
      commitBaseline(tree);
      setConfirmSaveOrder(false);
      try {
        // Apply the saved tree to the sidebar immediately (no page refresh).
        await refreshPermissions({ background: true, menuTree: tree });
      } catch (err) {
        notifyApiError(err, "Menu order saved, but authorization could not be refreshed");
      }
      await menusQuery.refetch();
    },
    onError: (err) => notifyApiError(err, "Failed to save menu order"),
  });

  useEffect(() => {
    resetToBaseline();
    setDraft([]);
    setCapabilityDraft([]);
    setExpandedIds(new Set());
  }, [roleId, resetToBaseline]);

  useEffect(() => {
    if (serverTree.length === 0) return;
    if (!isOrderDirty) {
      setDraft(serverTree);
      setExpandedIds(new Set(collectExpandableMenuIds(serverTree)));
    }
  }, [serverTree, isOrderDirty]);

  useEffect(() => {
    const next = capQuery.data?.capabilities ?? [];
    if (next.length === 0) return;
    setCapabilityDraft(next);
  }, [capQuery.data]);

  const isDirty = draft.length > 0 && !samePermissionTree(draft, serverTree);
  const serverCapabilities = capQuery.data?.capabilities ?? [];
  const isCapabilityDirty =
    capabilityDraft.length > 0 &&
    (capabilityDraft.length !== serverCapabilities.length ||
      capabilityDraft.some((item, index) => item.isGranted !== serverCapabilities[index]?.isGranted));

  const canReorderMenus =
    canModify && !saveMutation.isPending && !saveOrderMutation.isPending;

  const savingPermissions = saveMutation.isPending;
  const savingOrder = saveOrderMutation.isPending;
  const saving = savingPermissions || savingOrder;

  function toggle(menuId: string, flag: PermissionFlag) {
    setDraft((prev) => {
      const node = findPermissionNode(prev, menuId);
      if (!node) return prev;
      return setPermissionFlag(prev, menuId, flag, !node[flag]);
    });
  }

  function handleSave() {
    if (roleId == null || saveMutation.isPending) return;
    if (!isDirty && !isCapabilityDirty) return;
    saveMutation.mutate({
      roleId,
      permissions: flattenTreeForSave(draft),
      capabilities: capabilityDraft.map((item) => ({
        code: item.code,
        isGranted: item.isGranted,
      })),
      saveMenus: isDirty,
      saveCapabilities: isCapabilityDirty,
    });
  }

  function handleConfirmSaveOrder() {
    if (!isOrderDirty || saveOrderMutation.isPending || menuTreeDraft.length === 0) return;
    saveOrderMutation.mutate(menuTreeDraft);
  }

  function toggleExpanded(menuId: string, open: boolean) {
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

  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader
        title="Permissions"
        leading={
          fromRoles ? (
            <AppTooltip content="Back to roles" asChild>
              <Link
                to="/roles"
                aria-label="Back to roles"
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
          ) : undefined
        }
      />

      <div className="card-elevated px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-fit max-w-full">
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
                value={roleId ?? undefined}
                onValueChange={(v) => setRoleId(v)}
                disabled={saving}
              >
                <SelectTrigger
                  id="permissions-role"
                  className="w-fit max-w-[16rem] bg-background [&>span]:flex-none"
                  aria-label="Role"
                >
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isOrderDirty ? (
                <Button
                  size="sm"
                  onClick={() => setConfirmSaveOrder(true)}
                  disabled={savingOrder || savingPermissions}
                >
                  {savingOrder ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingOrder ? "Saving…" : "Save Order"}
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={(!isDirty && !isCapabilityDirty) || saving || roleId == null}
              >
                {savingPermissions ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingPermissions ? "Saving…" : "Save permissions"}
              </Button>
            </div>
          </Can>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {roleId == null ? (
            <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
              Select a role to manage its permissions.
            </div>
          ) : loadingTree ? (
            <div className="card-elevated grid place-items-center p-8 text-sm text-muted-foreground">
              <Loader2 className="mb-2 h-5 w-5 animate-spin" />
              Loading permissions…
            </div>
          ) : loadError ? (
            <div className="card-elevated p-8 text-center">
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
            <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
              No permissions found for this role.
            </div>
          ) : (
            <div className="card-elevated overflow-x-auto">
              <div className={cn(permissionGridClass, "gap-0 border-b bg-muted/50 text-xs text-muted-foreground")}>
                <div className="px-4 py-2 font-medium">Menu</div>
                <div className="px-3 py-2 text-center font-medium">Read</div>
                <div className="px-3 py-2 text-center font-medium">Modify</div>
                <div className="px-3 py-2 text-center font-medium">Delete</div>
              </div>
              <TreeSortableProvider
                disabled={!canReorderMenus}
                onReorder={reorderMenus}
                renderOverlay={(activeId) => {
                  const activeNode = findPermissionNode(draft, activeId);
                  return (
                    <div className={cn(permissionGridClass, "items-center rounded-md border bg-card px-4 py-2 shadow-lg")}>
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

        {roleId != null && capabilityDraft.length > 0 ? (
          <aside className="card-elevated w-full shrink-0 space-y-3 p-4 lg:w-80">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-sm font-semibold">Rates &amp; commercial</h3>
                <AppTooltip
                  content="Grant independently of menu access. Selected flags apply to every user with this role unless a user has their own override."
                  side="top"
                  align="start"
                  contentClassName="max-w-xs text-xs"
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Grant independently of menu access. Selected flags apply to every user with this role unless a user has their own override."
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </AppTooltip>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                disabled={!canModify || saving}
                onClick={() => {
                  const allGranted = capabilityDraft.every((item) => item.isGranted);
                  setCapabilityDraft((prev) =>
                    prev.map((row) => ({ ...row, isGranted: !allGranted })),
                  );
                }}
              >
                {capabilityDraft.every((item) => item.isGranted) ? "Deselect all" : "Select all"}
              </Button>
            </div>
            <div className="space-y-0.5">
              {capabilityDraft.map((item) => (
                <label
                  key={item.code}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                    "hover:bg-accent/50",
                    !canModify || saving ? "cursor-not-allowed opacity-60" : "",
                  )}
                >
                  <Checkbox
                    checked={item.isGranted}
                    disabled={!canModify || saving}
                    onCheckedChange={(checked) => {
                      setCapabilityDraft((prev) =>
                        prev.map((row) =>
                          row.code === item.code ? { ...row, isGranted: Boolean(checked) } : row,
                        ),
                      );
                    }}
                  />
                  <span className="text-sm font-medium leading-none text-foreground">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </aside>
        ) : null}
      </div>

      {confirmSaveOrder ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => !savingOrder && setConfirmSaveOrder(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Save Menu Order?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You have changed the menu order. Do you want to save these changes?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmSaveOrder(false)}
                disabled={savingOrder}
              >
                Cancel
              </Button>
              <Button disabled={savingOrder} onClick={handleConfirmSaveOrder}>
                {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
  expandedIds: Set<string>;
  onToggleExpanded: (menuId: string, open: boolean) => void;
  onToggleFlag: (menuId: string, flag: PermissionFlag) => void;
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
        permissionGridClass,
        "items-center hover:bg-muted/30",
        depth === 0 && hasChildren && "bg-muted/10",
      )}
    >
      <div
        className="flex min-w-0 items-center gap-1 px-4 py-2"
        style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
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
        <div key={flag} className="px-3 py-2 text-center">
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
