import { type ReactNode } from "react";
import { Can as MenuCan, usePermission } from "@/components/Permission";
import { permissionsForRole } from "@/lib/roles-store";
import { authStore, useAuthSession } from "@/lib/auth-store";
import type { PermissionKey } from "@/lib/permissions";
import type { MenuAction } from "@/lib/authorization";

/**
 * Legacy hook used by phase-2 modules (e.g. rates) that still rely on the
 * mock role catalogue. Prefer `usePermission` from `@/components/Permission`
 * for menu-backed ACL from the login response.
 */
export function useCan(permission: PermissionKey | PermissionKey[] | undefined): boolean {
  useAuthSession();
  if (!permission) return true;
  const u = authStore.getUser();
  if (!u) return false;
  const perms = permissionsForRole(u.role);
  const list = Array.isArray(permission) ? permission : [permission];
  return list.every((p) => perms.has(p));
}

type LegacyCanProps = {
  permission?: PermissionKey;
  any?: PermissionKey[];
  children: ReactNode;
  fallback?: ReactNode;
};

type MenuCanProps = {
  code?: string;
  route?: string;
  action?: MenuAction;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Dual-mode gate:
 * - Menu ACL (preferred): `code` / `route` + `action` from login `menus`
 * - Legacy: `permission` / `any` PermissionKey (phase-2 pages)
 */
export function Can(props: LegacyCanProps | MenuCanProps) {
  if ("code" in props || "route" in props) {
    const { code, route, action, children, fallback } = props as MenuCanProps;
    return (
      <MenuCan code={code} route={route} action={action} fallback={fallback}>
        {children}
      </MenuCan>
    );
  }

  const { permission, any, children, fallback = null } = props as LegacyCanProps;
  useAuthSession();
  const u = authStore.getUser();
  if (!u) return <>{fallback}</>;
  const perms = permissionsForRole(u.role);
  const allowed = permission
    ? perms.has(permission)
    : any
      ? any.some((p) => perms.has(p))
      : true;
  return <>{allowed ? children : fallback}</>;
}

export { usePermission };
