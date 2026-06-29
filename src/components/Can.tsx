import { type ReactNode } from "react";
import { permissionsForRole } from "@/lib/roles-store";
import { authStore, useAuthSession } from "@/lib/auth-store";
import type { PermissionKey } from "@/lib/permissions";

/** Hook: does the current signed-in user have this permission? */
export function useCan(permission: PermissionKey | PermissionKey[] | undefined): boolean {
  useAuthSession(); // subscribe so we re-render on sign-in/out
  if (!permission) return true;
  const u = authStore.getUser();
  if (!u) return false;
  const perms = permissionsForRole(u.role);
  const list = Array.isArray(permission) ? permission : [permission];
  return list.every(p => perms.has(p));
}

/** Component: render children only if user has the permission. Optional `fallback`. */
export function Can({
  permission,
  any,
  children,
  fallback = null,
}: {
  permission?: PermissionKey;
  any?: PermissionKey[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  useAuthSession();
  const u = authStore.getUser();
  if (!u) return <>{fallback}</>;
  const perms = permissionsForRole(u.role);
  const allowed = permission
    ? perms.has(permission)
    : any
      ? any.some(p => perms.has(p))
      : true;
  return <>{allowed ? children : fallback}</>;
}
