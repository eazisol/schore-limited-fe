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
    const existing = authStore.get();
    authStore.demoSetUser(user.id, existing?.remember ?? false);
  },

  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
}

export function isAdmin(s: Session = cached) { return s.role === "CEO"; }
