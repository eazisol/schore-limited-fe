// Compat shim — delegates to the new auth-store so the existing screens keep working.
import { useSyncExternalStore } from "react";
import { authStore } from "./auth-store";
import { usersStore, type UserRole } from "./users-store";

export interface Session {
  name: string;
  initials: string;
  jobTitle: string;
  role: UserRole;
  email: string;
}

const fallback: Session = {
  name: "Guest",
  initials: "—",
  jobTitle: "",
  role: "SM",
  email: "",
};

function deriveSession(): Session {
  const u = authStore.getUser();
  if (!u) return fallback;
  const initials = u.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return { name: u.name, initials, jobTitle: u.jobTitle ?? "", role: u.role, email: u.email };
}

let cached: Session = deriveSession();
const listeners = new Set<() => void>();

function refresh() {
  cached = deriveSession();
  listeners.forEach(l => l());
}

authStore.subscribe(refresh);
usersStore.subscribe(refresh);

export const sessionStore = {
  get: () => cached,
  /** Demo-only: switch the active user by role. Picks the first active user with that role. */
  setRole: (role: UserRole) => {
    const user = usersStore.getAll().find(u => u.role === role && u.status === "Active");
    if (!user) return;
    // Re-create a session pointing at that user, keeping current remember setting.
    const existing = authStore.get();
    const remember = existing?.remember ?? false;
    const ttl = remember ? 30 * 24 * 3600 * 1000 : 12 * 3600 * 1000;
    // Direct internal mutation via a synthetic sign-in: bypass password (demo switch only).
    // We achieve this by writing into the auth store via signIn helper — but to avoid duplicating
    // logic and to allow demo switching, we use a dedicated path:
    (authStore as unknown as { _demoSetUser?: (id: string, remember: boolean, ttl: number) => void })._demoSetUser?.(user.id, remember, ttl);
  },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
}

export function isAdmin(s: Session = cached) { return s.role === "CEO"; }
