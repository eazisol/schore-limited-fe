import { useSyncExternalStore } from "react";
import type { RoleKey } from "./roles-store";

// Re-export RoleKey under the old name for backwards compatibility with existing screens.
export type UserRole = RoleKey;
export type UserStatus = "Active" | "Inactive";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;            // primary role
  status: UserStatus;
  jobTitle?: string;
  avatar?: string;           // data URL (base64)
  /** Demo-only password hash. If empty, any 6+ char password is accepted (seeded demo accounts). */
  passwordHash?: string;
  createdAt: string;
  lastLogin?: string;
}

const STORAGE_KEY = "schore.users.v1";

const seed: AppUser[] = [
  { id: "u_001", name: "Daniel Schore",   email: "daniel@schore.co.uk",  phone: "07700 900101", role: "CEO", status: "Active",   jobTitle: "CEO",                 createdAt: "2024-01-12", lastLogin: "2026-06-29 08:14" },
  { id: "u_002", name: "Marcus Reid",     email: "marcus@schore.co.uk",  phone: "07700 900102", role: "CM",  status: "Active",   jobTitle: "Contracts Manager",   createdAt: "2024-02-03", lastLogin: "2026-06-29 07:42" },
  { id: "u_003", name: "Florin Vasile",   email: "florin@schore.co.uk",  phone: "07700 900103", role: "PM",  status: "Active",   jobTitle: "Project Manager",     createdAt: "2024-04-19", lastLogin: "2026-06-28 18:30" },
  { id: "u_004", name: "Claudiu Ceausu",  email: "claudiu@schore.co.uk", phone: "07700 900104", role: "SM",  status: "Active",   jobTitle: "Site Manager",        createdAt: "2024-06-02", lastLogin: "2026-06-29 06:55" },
  { id: "u_005", name: "Priya Patel",     email: "priya@schore.co.uk",   phone: "07700 900105", role: "SM",  status: "Active",   jobTitle: "Site Manager",        createdAt: "2024-09-14", lastLogin: "2026-06-27 16:11" },
  { id: "u_006", name: "Tom Wright",      email: "tom@schore.co.uk",     phone: "07700 900106", role: "SM",  status: "Inactive", jobTitle: "Site Manager",        createdAt: "2024-11-08", lastLogin: "2025-12-14 09:02" },
];

function load(): AppUser[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    return JSON.parse(raw) as AppUser[];
  } catch { return seed; }
}
function save(u: AppUser[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch {}
}

let users: AppUser[] = load();
const listeners = new Set<() => void>();
const emit = () => { save(users); listeners.forEach(l => l()); };

// Simple demo hash. NOT real cryptography — frontend-only sim.
export async function hashPassword(pw: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(pw);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback (SSR or old browser): not secure, but this app is frontend-demo.
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (h * 31 + pw.charCodeAt(i)) | 0;
  return `fallback_${h}`;
}

export const usersStore = {
  getAll: () => users,
  get: (id: string) => users.find(u => u.id === id),
  byEmail: (email: string) => users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()),
  create: (u: Omit<AppUser, "id" | "createdAt">) => {
    const id = `u_${String(users.length + 1).padStart(3, "0")}`;
    const created: AppUser = { ...u, id, createdAt: new Date().toISOString().slice(0, 10) };
    users = [created, ...users];
    emit();
    return created;
  },
  update: (id: string, patch: Partial<AppUser>) => {
    users = users.map(u => (u.id === id ? { ...u, ...patch } : u));
    emit();
  },
  setStatus: (id: string, status: UserStatus) => {
    users = users.map(u => (u.id === id ? { ...u, status } : u));
    emit();
  },
  remove: (id: string) => {
    users = users.filter(u => u.id !== id);
    emit();
  },
  markLogin: (id: string) => {
    const now = new Date().toISOString().slice(0, 16).replace("T", " ");
    users = users.map(u => (u.id === id ? { ...u, lastLogin: now } : u));
    emit();
  },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useUsers() {
  return useSyncExternalStore(usersStore.subscribe, usersStore.getAll, usersStore.getAll);
}

export const ROLES: UserRole[] = ["CEO", "CM", "PM", "SM"];

export const ROLE_BADGE: Record<UserRole, string> = {
  CEO: "bg-destructive/10 text-destructive border-destructive/20",
  CM:  "bg-info/10 text-info border-info/20",
  PM:  "bg-accent/15 text-accent-foreground border-accent/30",
  SM:  "bg-muted text-foreground/70 border-border",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  CEO: "CEO",
  CM:  "Contracts Manager",
  PM:  "Project Manager",
  SM:  "Site Manager",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  CEO: "Full platform access · manage everything · manage rates",
  CM:  "Manage contracts & projects · approve payroll · manage rates",
  PM:  "Manage project activities · allocate operatives · run payroll · view costs · manage rates",
  SM:  "Allocate operatives · record work · cost splitting · view (not edit) rates & money",
};

export function validateUser(input: {
  name: string; email: string; role: string; phone?: string;
}, opts: { existingEmails: string[]; excludeEmail?: string }) {
  const errs: Record<string, string> = {};
  if (!input.name.trim()) errs.name = "Name is required";
  else if (input.name.trim().length < 2) errs.name = "Name must be at least 2 characters";
  else if (input.name.length > 80) errs.name = "Name must be under 80 characters";

  const email = input.email.trim().toLowerCase();
  if (!email) errs.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address";
  else if (
    opts.existingEmails.map(e => e.toLowerCase()).includes(email) &&
    email !== opts.excludeEmail?.toLowerCase()
  ) errs.email = "A user with this email already exists";

  if (!input.role) errs.role = "Role is required";
  else if (!ROLES.includes(input.role as UserRole)) errs.role = "Invalid role";

  return errs;
}
