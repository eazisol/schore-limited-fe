import { useSyncExternalStore } from "react";
import { usersStore, hashPassword, type AppUser } from "./users-store";

export interface AuthSession {
  userId: string;
  expiresAt: number; // epoch ms
  remember: boolean;
}

const KEY = "schore.auth.v1";

function readStorage(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (s.expiresAt < Date.now()) {
      window.localStorage.removeItem(KEY);
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

function writeStorage(s: AuthSession | null) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.sessionStorage.removeItem(KEY);
  if (!s) return;
  const store = s.remember ? window.localStorage : window.sessionStorage;
  store.setItem(KEY, JSON.stringify(s));
}

let session: AuthSession | null = readStorage();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export type SignInResult =
  | { ok: true; user: AppUser }
  | { ok: false; reason: "not_found" | "inactive" | "wrong_password" };

export const authStore = {
  get: () => session,
  getUser: (): AppUser | null => (session ? usersStore.get(session.userId) ?? null : null),
  signIn: async (email: string, password: string, remember: boolean): Promise<SignInResult> => {
    const user = usersStore.byEmail(email);
    if (!user) return { ok: false, reason: "not_found" };
    if (user.status === "Inactive") return { ok: false, reason: "inactive" };

    if (user.passwordHash) {
      const hash = await hashPassword(password);
      if (hash !== user.passwordHash) return { ok: false, reason: "wrong_password" };
    } else {
      // Seeded demo user — accept any 6+ char password.
      if (password.length < 6) return { ok: false, reason: "wrong_password" };
    }

    const ttl = remember ? 30 * 24 * 3600 * 1000 : 12 * 3600 * 1000;
    session = { userId: user.id, expiresAt: Date.now() + ttl, remember };
    writeStorage(session);
    usersStore.markLogin(user.id);
    emit();
    return { ok: true, user };
  },
  signOut: () => {
    session = null;
    writeStorage(null);
    emit();
  },
  setPassword: async (userId: string, newPassword: string) => {
    const hash = await hashPassword(newPassword);
    usersStore.update(userId, { passwordHash: hash });
  },
  /** Demo helper: switch to a specific user without password (used by sidebar role switcher). */
  demoSetUser: (userId: string, remember = false) => {
    const ttl = remember ? 30 * 24 * 3600 * 1000 : 12 * 3600 * 1000;
    session = { userId, expiresAt: Date.now() + ttl, remember };
    writeStorage(session);
    emit();
  },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};


export function useAuthSession() {
  return useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);
}
