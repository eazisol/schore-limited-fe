import { type ReactNode, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  canAccessPath,
  getMenuPermission,
  resolveMenuForAppPath,
  type MenuAction,
} from "@/lib/authorization";

export type PermissionTarget = {
  /** Menu code from the login response (e.g. `USERS`). */
  code?: string;
  /** Menu route or app path (e.g. `/users`). */
  route?: string;
  /** Explicit pathname for settings sub-routes and nested pages. */
  pathname?: string;
  action?: MenuAction;
};

/** Hook: check read/modify/delete against login `menus`. */
export function usePermission(target: PermissionTarget): boolean {
  const { menus, isAuthenticated } = useAuth();
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
  const { menus, isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!isAuthenticated) return false;
  return getMenuPermission(menus, action, { pathname });
}

/** The login menu entry governing the current route. */
export function useRouteMenu() {
  const { menus } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return resolveMenuForAppPath(menus, pathname);
}

/**
 * Render children only when the user has the given menu permission.
 * Prefer `pathname`, `code`, or `route` from login menus.
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
  const { menus, isHydrated, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const allowed = !isHydrated || !isAuthenticated || canAccessPath(menus, pathname);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    if (!canAccessPath(menus, pathname)) {
      navigate({ to: "/forbidden" });
    }
  }, [isHydrated, isAuthenticated, menus, pathname, navigate]);

  if (!allowed) return null;
  return <>{children}</>;
}
