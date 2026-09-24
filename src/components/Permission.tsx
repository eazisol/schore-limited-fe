import { type ReactNode, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  canAccessPath,
  getDefaultHomePath,
  getMenuPermission,
  isAppHomePath,
  resolveMenuForAppPath,
  toAppPath,
  type MenuAction,
} from "@/lib/authorization";
import { isOperativeUserType } from "@/lib/operative-portal";

export type PermissionTarget = {
  /** Menu code from the permission-backed menu tree (e.g. `USERS`). */
  code?: string;
  /** Menu route or app path (e.g. `/users`). */
  route?: string;
  /** Explicit pathname for settings sub-routes and nested pages. */
  pathname?: string;
  action?: MenuAction;
};

/** Hook: check read/modify/delete against the centralized permission state. */
export function usePermission(target: PermissionTarget): boolean {
  const { isAuthenticated } = useAuth();
  const { menus } = usePermissions();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const action = target.action ?? "read";
  if (!isAuthenticated) return false;

  const pathname = target.pathname ?? (!target.code && !target.route ? currentPath : undefined);
  if (!target.code && !target.route && !pathname) return false;

  return getMenuPermission(menus, action, {
    code: target.code,
    route: target.route,
    pathname,
  });
}

/** Permission check for the current route pathname. */
export function usePathPermission(action: MenuAction = "read"): boolean {
  const { isAuthenticated } = useAuth();
  const { menus } = usePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!isAuthenticated) return false;
  return getMenuPermission(menus, action, { pathname });
}

/** The permission-backed menu entry governing the current route. */
export function useRouteMenu() {
  const { menus } = usePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return resolveMenuForAppPath(menus, pathname);
}

/**
 * Render children only when the user has the given menu permission.
 * Prefer `pathname`, `code`, or `route` from the permission-backed menu tree.
 */
export function Can({
  code,
  route,
  pathname,
  action = "read",
  children,
  fallback = null,
}: PermissionTarget & {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = usePermission({ code, route, pathname, action });
  return <>{allowed ? children : fallback}</>;
}

/**
 * Blocks rendering and redirects to `/forbidden` when the user lacks the permission.
 */
export function RequirePermission({
  code,
  route,
  pathname,
  action = "read",
  children,
}: PermissionTarget & { children: ReactNode }) {
  const navigate = useNavigate();
  const allowed = usePermission({ code, route, pathname, action });

  useEffect(() => {
    if (!allowed) navigate({ to: "/forbidden" });
  }, [allowed, navigate]);

  if (!allowed) return null;
  return <>{children}</>;
}

/**
 * Route-level guard: redirects to `/forbidden` when the pathname is not allowed.
 */
export function RoutePermissionGuard({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const { isHydrated, isAuthenticated, user } = useAuth();
  const { menus, isLoading } = usePermissions();
  const navigate = useNavigate();
  const permissionsBlocking = isLoading && menus.length === 0;
  const allowed =
    isHydrated && isAuthenticated && !permissionsBlocking && canAccessPath(menus, pathname);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || permissionsBlocking) return;
    if (canAccessPath(menus, pathname)) return;

    // Default landing (`/` / dashboard) is not granted for every role — send them
    // to the first menu they can open instead of the Access denied screen.
    if (isAppHomePath(pathname)) {
      if (isOperativeUserType(user?.userTypeCode)) {
        navigate({ to: "/operatives/me", replace: true });
        return;
      }
      const home = getDefaultHomePath(menus);
      if (home !== toAppPath(pathname)) {
        navigate({ to: home, replace: true });
        return;
      }
    }

    navigate({ to: "/forbidden" });
  }, [isHydrated, isAuthenticated, permissionsBlocking, menus, pathname, navigate, user?.userTypeCode]);

  if (!allowed) return null;
  return <>{children}</>;
}
