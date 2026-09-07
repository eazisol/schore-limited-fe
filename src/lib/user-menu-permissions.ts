import type { ApiPermission, UpsertPermission } from "@/lib/api/services/permissions";
import type { UserMenuPermissionOverrideFormValue } from "@/lib/user-form";
import { flattenTreeForSave, type PermissionTreeNode } from "@/lib/permission-tree";

export function toOverridePermissions(
  overrides: UserMenuPermissionOverrideFormValue[],
): ApiPermission[] {
  return overrides.map((row) => ({
    id: null,
    menuId: row.menuId,
    menuName: null,
    menuCode: null,
    roleId: "",
    roleName: null,
    read: row.read,
    modify: row.modify,
    delete: row.delete,
  }));
}

export function diffMenuOverrides(
  next: UpsertPermission[],
  role: UpsertPermission[],
): UserMenuPermissionOverrideFormValue[] {
  const roleMap = new Map(role.map((row) => [row.menuId, row]));
  return next.filter((row) => {
    const baseline = roleMap.get(row.menuId);
    return (
      row.read !== Boolean(baseline?.read) ||
      row.modify !== Boolean(baseline?.modify) ||
      row.delete !== Boolean(baseline?.delete)
    );
  });
}

export function sameMenuOverrides(
  left: UserMenuPermissionOverrideFormValue[],
  right: UserMenuPermissionOverrideFormValue[],
): boolean {
  if (left.length !== right.length) return false;
  const rightMap = new Map(right.map((row) => [row.menuId, row]));
  return left.every((row) => {
    const match = rightMap.get(row.menuId);
    return (
      match != null &&
      match.read === row.read &&
      match.modify === row.modify &&
      match.delete === row.delete
    );
  });
}

export function flattenRoleTree(tree: PermissionTreeNode[]): UpsertPermission[] {
  return flattenTreeForSave(tree);
}
