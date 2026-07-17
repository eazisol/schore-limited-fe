import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService, type ApiLoginData } from "@/lib/api/services/auth";
import { tokenStore, onUnauthorized, type ApiError } from "@/lib/api/axios";
import {
  clearLegacySessionKeys,
  getStoredSession,
  saveStoredSession,
  type AuthUser,
  type SessionShape,
} from "@/lib/session";

function toAuthUser(d: ApiLoginData): AuthUser {
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(" ").trim() || d.username;
  return {
    id: d.userId,
    username: d.username,
    email: d.email,
    firstName: d.firstName ?? "",
    lastName: d.lastName ?? "",
    fullName,
    roles: d.roles ?? [],
    role: d.roles?.[0] ?? "",
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isSigningIn: boolean;
  signIn: (
    emailOrUsername: string,
    password: string,
  ) => Promise<
    { ok: true; user: AuthUser; message: string } |
    { ok: false; message: string; toasted?: boolean }
  >;
  updateUser: (patch: Partial<AuthUser>) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionShape | null>(null);
  const [isHydrated, setHydrated] = useState(false);
  const [isSigningIn, setSigningIn] = useState(false);

  useEffect(() => {
    clearLegacySessionKeys();
    const stored = getStoredSession();
    if (stored) tokenStore.set(stored.token, true);
    setSession(stored);
    setHydrated(true);
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        saveStoredSession(null);
        tokenStore.clear();
        setSession(null);
      }),
    [],
  );

  const signIn: AuthContextValue["signIn"] = useCallback(async (emailOrUsername, password) => {
    setSigningIn(true);
    try {
      const res = await authService.login({ emailOrUsername, password });
      if (!res?.success || !res.data?.token) {
        return { ok: false, message: res?.message ?? "Login failed" };
      }
      const user = toAuthUser(res.data);
      const next: SessionShape = {
        token: res.data.token,
        expiresAt: res.data.expiresAt,
        user,
      };
      saveStoredSession(next);
      tokenStore.set(next.token, true);
      setSession(next);
      return { ok: true, user, message: res.message };
    } catch (err) {
      const e = err as ApiError;
      return {
        ok: false,
        message: e?.message || "Unable to sign in. Please try again.",
        toasted: e?.toasted,
      };
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(() => {
    saveStoredSession(null);
    tokenStore.clear();
    setSession(null);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const user = { ...prev.user, ...patch };
      if (patch.firstName != null || patch.lastName != null) {
        user.fullName =
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username;
      }
      const next = { ...prev, user };
      saveStoredSession(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: !!session,
      isHydrated,
      isSigningIn,
      signIn,
      updateUser,
      signOut,
    }),
    [session, isHydrated, isSigningIn, signIn, updateUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export type { AuthUser } from "@/lib/session";
