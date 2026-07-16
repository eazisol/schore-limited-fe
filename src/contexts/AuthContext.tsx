import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService, type ApiLoginData, type ApiMenu } from "@/lib/api/services/auth";
import { tokenStore, onUnauthorized, type ApiError } from "@/lib/api/axios";

/**
 * API-backed authentication session.
 * Persisted in localStorage under `SESSION_KEY`; token is mirrored into the
 * axios `tokenStore` so all requests carry `Authorization: Bearer <token>`.
 * `menus` from the login response is the single source of truth for ACL.
 */
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: string[];
  role: string; // primary role code (first element)
}

interface SessionShape {
  token: string;
  expiresAt: string;
  user: AuthUser;
  menus: ApiMenu[];
}

const SESSION_KEY = "schore.api.session.v2";

function loadSession(): SessionShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionShape;
    if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (!s.token || !s.user) return null;
    return { ...s, menus: Array.isArray(s.menus) ? s.menus : [] };
  } catch {
    return null;
  }
}

function saveSession(s: SessionShape | null) {
  if (typeof window === "undefined") return;
  if (!s) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

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
  menus: ApiMenu[];
  isAuthenticated: boolean;
  isHydrated: boolean;
  isSigningIn: boolean;
  signIn: (
    emailOrUsername: string,
    password: string,
  ) => Promise<{ ok: true; user: AuthUser } | { ok: false; message: string; toasted?: boolean }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionShape | null>(null);
  const [isHydrated, setHydrated] = useState(false);
  const [isSigningIn, setSigningIn] = useState(false);

  useEffect(() => {
    // Drop legacy session keys that did not include menus.
    try {
      window.localStorage.removeItem("schore.api.session.v1");
    } catch {
      /* ignore */
    }
    const s = loadSession();
    if (s) tokenStore.set(s.token, true);
    setSession(s);
    setHydrated(true);
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        saveSession(null);
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
        menus: res.data.menus ?? [],
      };
      saveSession(next);
      tokenStore.set(next.token, true);
      setSession(next);
      return { ok: true, user };
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
    saveSession(null);
    tokenStore.clear();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      menus: session?.menus ?? [],
      isAuthenticated: !!session,
      isHydrated,
      isSigningIn,
      signIn,
      signOut,
    }),
    [session, isHydrated, isSigningIn, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
