import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import type { ApiMenu } from "@/lib/api/services/auth";
import { menusService, type ApiMenuDefinition } from "@/lib/api/services/menus";
import { permissionsService } from "@/lib/api/services/permissions";
import { usersService } from "@/lib/api/services/users";
import { buildAuthorizedMenus } from "@/lib/authorization";

interface PermissionCache {
  userId: number | null;
  roleIds: number[] | null;
  menuTree: ApiMenuDefinition[] | null;
}

interface PermissionContextValue {
  menus: ApiMenu[];
  isLoading: boolean;
  error: unknown;
  refreshPermissions: (options?: {
    background?: boolean;
    /** When set, use this tree instead of the cached/fetched Menus/tree. */
    menuTree?: ApiMenuDefinition[];
    /** Force a fresh Menus/tree fetch (ignores cache). */
    forceMenuTree?: boolean;
  }) => Promise<void>;
}

export const PERMISSION_UPDATED_STORAGE_KEY = "schore.permissions.updated";

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isHydrated } = useAuth();
  const queryClient = useQueryClient();
  const [menus, setMenus] = useState<ApiMenu[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const cacheRef = useRef<PermissionCache>({
    userId: null,
    roleIds: null,
    menuTree: null,
  });
  const requestIdRef = useRef(0);
  const lastRefreshAtRef = useRef(0);
  const userId = user?.id ?? null;

  const refreshPermissions = useCallback(async (options?: {
    background?: boolean;
    menuTree?: ApiMenuDefinition[];
    forceMenuTree?: boolean;
  }) => {
    if (!isAuthenticated || userId == null) {
      setMenus([]);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    lastRefreshAtRef.current = Date.now();
    const background = options?.background ?? menus.length > 0;
    if (!background) {
      setLoading(true);
    }
    setError(null);

    try {
      if (cacheRef.current.userId !== userId) {
        cacheRef.current = { userId, roleIds: null, menuTree: null };
      }

      const [roleIds, menuTree] = await Promise.all([
        cacheRef.current.roleIds != null
          ? Promise.resolve(cacheRef.current.roleIds)
          : queryClient.fetchQuery({
              queryKey: ["users", userId],
              queryFn: async () => (await usersService.get(userId)).data,
              staleTime: 60_000,
            }).then((apiUser) => apiUser.roleIds ?? []),
        options?.menuTree != null
          ? Promise.resolve(options.menuTree)
          : options?.forceMenuTree
            ? menusService.tree().then((response) => response.data ?? [])
            : cacheRef.current.menuTree != null
              ? Promise.resolve(cacheRef.current.menuTree)
              : menusService.tree().then((response) => response.data ?? []),
      ]);

      cacheRef.current = { userId, roleIds, menuTree };
      const permissionResponses = await Promise.all(
        roleIds.map((roleId) => permissionsService.getByRole(roleId)),
      );
      const nextMenus = buildAuthorizedMenus(
        menuTree,
        permissionResponses.map((response) => response.data ?? []),
      );

      if (requestId === requestIdRef.current) setMenus(nextMenus);
    } catch (nextError) {
      if (requestId === requestIdRef.current) {
        setError(nextError);
      }
      throw nextError;
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [isAuthenticated, menus.length, queryClient, userId]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated || userId == null) {
      requestIdRef.current += 1;
      cacheRef.current = { userId: null, roleIds: null, menuTree: null };
      setMenus([]);
      setError(null);
      setLoading(false);
      return;
    }

    void refreshPermissions().catch(() => {
      // The error is exposed through context for the authenticated shell.
    });
  }, [isAuthenticated, isHydrated, refreshPermissions, userId]);

  useEffect(() => {
    if (!isAuthenticated || userId == null) return;

    const refreshIfActive = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (Date.now() - lastRefreshAtRef.current < 1_000) return;
      void refreshPermissions({ background: true }).catch(() => {
        // Keep the current authorization state when a background refresh fails.
      });
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PERMISSION_UPDATED_STORAGE_KEY) refreshIfActive();
    };

    window.addEventListener("focus", refreshIfActive);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", refreshIfActive);
    return () => {
      window.removeEventListener("focus", refreshIfActive);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", refreshIfActive);
    };
  }, [isAuthenticated, refreshPermissions, userId]);

  const permissionsLoading =
    isLoading ||
    (isHydrated &&
      isAuthenticated &&
      userId != null &&
      cacheRef.current.userId !== userId &&
      error == null);

  const value = useMemo<PermissionContextValue>(
    () => ({ menus, isLoading: permissionsLoading, error, refreshPermissions }),
    [menus, permissionsLoading, error, refreshPermissions],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) throw new Error("usePermissions must be used inside <PermissionProvider>");
  return context;
}
