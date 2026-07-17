import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lookupsService, type ApiRole } from "@/lib/api/services/lookups";
import {
  permissionsService,
  type ApiPermission,
  type UpsertPermission,
} from "@/lib/api/services/permissions";
import { notifyApiError } from "@/lib/api/axios";
import { Can, usePathPermission } from "@/components/Permission";
import {
  PERMISSION_UPDATED_STORAGE_KEY,
  usePermissions,
} from "@/contexts/PermissionContext";

export const Route = createFileRoute("/settings/role-permissions")({
  head: () => ({ meta: [{ title: "Role Permissions | Settings" }] }),
  component: RolePermissionsPage,
});

type PermFlag = "read" | "modify" | "delete";

type DraftPermission = {
  menuId: number;
  menuName: string;
  menuCode: string;
  read: boolean;
  modify: boolean;
  delete: boolean;
};

function toDraft(items: ApiPermission[]): DraftPermission[] {
  return items.map(p => ({
    menuId: p.menuId,
    menuName: p.menuName?.trim() || p.menuCode?.trim() || `Menu #${p.menuId}`,
    menuCode: p.menuCode?.trim() || "",
    read: Boolean(p.read),
    modify: Boolean(p.modify),
    delete: Boolean(p.delete),
  }));
}

function sameDraft(a: DraftPermission[], b: DraftPermission[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
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

function RolePermissionsPage() {
  const qc = useQueryClient();
  const canModify = usePathPermission("modify");
  const { refreshPermissions } = usePermissions();
  const [roleId, setRoleId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftPermission[]>([]);

  // Reuse the shared ["roles"] cache from User Management — do not use a different key.
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await lookupsService.roles()).data ?? [],
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

  const serverDraft = useMemo(
    () => (permsQuery.data ? toDraft(permsQuery.data) : []),
    [permsQuery.data],
  );

  useEffect(() => {
    setDraft([]);
  }, [roleId]);

  useEffect(() => {
    if (permsQuery.isSuccess && permsQuery.data) {
      setDraft(toDraft(permsQuery.data));
    }
  }, [permsQuery.isSuccess, permsQuery.data]);

  const isDirty = draft.length > 0 && !sameDraft(draft, serverDraft);

  const saveMutation = useMutation({
    mutationFn: (payload: { roleId: number; permissions: UpsertPermission[] }) =>
      permissionsService.assign(payload),
    onSuccess: async (res, vars) => {
      toast.success(res.message || "Permissions saved");
      const next = res.data ?? [];
      qc.setQueryData(["permissions", "role", vars.roleId], next);
      setDraft(toDraft(next));
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

  function toggle(menuId: number, flag: PermFlag) {
    setDraft(prev =>
      prev.map(row => (row.menuId === menuId ? { ...row, [flag]: !row[flag] } : row)),
    );
  }

  function handleSave() {
    if (roleId == null || !isDirty || saveMutation.isPending) return;
    saveMutation.mutate({
      roleId,
      permissions: draft.map(({ menuId, read, modify, delete: del }) => ({
        menuId,
        read,
        modify,
        delete: del,
      })),
    });
  }

  const showTable = roleId != null && permsQuery.isSuccess && draft.length > 0;
  const saving = saveMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="card-elevated p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full space-y-2 sm:w-64">
            <label htmlFor="role-permissions-role" className="text-xs font-medium text-muted-foreground">
              Role
            </label>
            {rolesQuery.isLoading ? (
              <div className="h-9 flex items-center gap-2 text-sm text-muted-foreground">
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
                onValueChange={v => setRoleId(Number(v))}
                disabled={saving}
              >
                <SelectTrigger id="role-permissions-role" className="bg-background">
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

          <Can action="modify">
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
      ) : permsQuery.isLoading || (permsQuery.isFetching && draft.length === 0) ? (
        <div className="card-elevated p-12 grid place-items-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mb-2" />
          Loading permissions…
        </div>
      ) : permsQuery.isError ? (
        <div className="card-elevated p-12 text-center">
          <AlertCircle className="h-5 w-5 mx-auto text-destructive mb-2" />
          <div className="text-sm font-medium">Unable to load permissions</div>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => permsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : !showTable ? (
        <div className="card-elevated p-12 text-center text-sm text-muted-foreground">
          No permissions found for this role.
        </div>
      ) : (
        <div className="card-elevated overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">Menu</th>
                <th className="text-center font-medium px-3 py-2.5 w-24">Read</th>
                <th className="text-center font-medium px-3 py-2.5 w-24">Modify</th>
                <th className="text-center font-medium px-3 py-2.5 w-24">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {draft.map(row => (
                <tr key={row.menuId} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-medium">{row.menuName}</div>
                  </td>
                  {(["read", "modify", "delete"] as const).map(flag => (
                    <td key={flag} className="px-3 py-3 text-center">
                      <div className="inline-flex justify-center">
                        <Checkbox
                          checked={row[flag]}
                          disabled={saving || !canModify}
                          onCheckedChange={() => toggle(row.menuId, flag)}
                          aria-label={`${row.menuName} ${flag}`}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
