import { useSyncExternalStore } from "react";
import type { UserRole } from "./users-store";

export interface Session {
  name: string;
  initials: string;
  jobTitle: string;
  role: UserRole;
  email: string;
}

const defaultSession: Session = {
  name: "Daniel Schore",
  initials: "DS",
  jobTitle: "CEO",
  role: "Admin",
  email: "daniel@schore.co.uk",
};

let session: Session = defaultSession;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const sessionStore = {
  get: () => session,
  setRole: (role: UserRole) => {
    const presets: Record<UserRole, Session> = {
      Admin:   { name: "Daniel Schore",  initials: "DS", jobTitle: "CEO",                role: "Admin",   email: "daniel@schore.co.uk" },
      Manager: { name: "Marcus Reid",    initials: "MR", jobTitle: "Contracts Manager",  role: "Manager", email: "marcus@schore.co.uk" },
      User:    { name: "Claudiu Ceausu", initials: "CC", jobTitle: "Site Manager",       role: "User",    email: "claudiu@schore.co.uk" },
    };
    session = presets[role];
    emit();
  },
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
};

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
}

export function isAdmin(s: Session = session) { return s.role === "Admin"; }
