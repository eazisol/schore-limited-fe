import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authStore, useAuthSession } from "@/lib/auth-store";
import { usersStore, type AppUser } from "@/lib/users-store";
import { permissionsForRole } from "@/lib/roles-store";
import type { PermissionKey } from "@/lib/permissions";
import { tokenStore, onUnauthorized } from "@/lib/api/axios";

interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  permissions: Set<PermissionKey>;
  can: (permission?: PermissionKey, anyOf?: PermissionKey[]) => boolean;
  signIn: (
    email: string,
    password: string,
    remember: boolean,
  ) => Promise<
    | { ok: true; user: AppUser }
    | { ok: false; reason: "not_found" | "inactive" | "wrong_password" }
  >;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  useAuthSession(); // re-render on session change
  const [isHydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const user = authStore.getUser();

  // Sync axios token store with the current session (demo: uses userId as token).
  useEffect(() => {
    if (user) tokenStore.set(user.id, authStore.get()?.remember ?? false);
    else tokenStore.clear();
  }, [user?.id]);

  // Global 401 → sign out.
  useEffect(() => onUnauthorized(() => authStore.signOut()), []);

  const permissions = useMemo(
    () => (user ? permissionsForRole(user.role) : new Set<PermissionKey>()),
    [user?.role],
  );

  const can = useCallback(
    (permission?: PermissionKey, anyOf?: PermissionKey[]) => {
      if (permission) return permissions.has(permission);
      if (anyOf) return anyOf.some(p => permissions.has(p));
      return true;
    },
    [permissions],
  );

  const signIn: AuthContextValue["signIn"] = useCallback(
    async (email, password, remember) => {
      const result = await authStore.signIn(email, password, remember);
      if (result.ok) {
        tokenStore.set(result.user.id, remember);
        usersStore.markLogin(result.user.id);
      }
      return result;
    },
    [],
  );

  const signOut = useCallback(() => {
    authStore.signOut();
    tokenStore.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isHydrated,
      permissions,
      can,
      signIn,
      signOut,
    }),
    [user, isHydrated, permissions, can, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
