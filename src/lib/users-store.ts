import { useSyncExternalStore } from "react";

export type UserRole = "Admin" | "Manager" | "User";
export type UserStatus = "Active" | "Inactive";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  jobTitle?: string;
  createdAt: string;
  lastLogin?: string;
}

const seed: AppUser[] = [
  { id: "u_001", name: "Daniel Schore",   email: "daniel@schore.co.uk",  phone: "07700 900101", role: "Admin",   status: "Active",   jobTitle: "CEO",            createdAt: "2024-01-12", lastLogin: "2026-01-22 08:14" },
  { id: "u_002", name: "Marcus Reid",     email: "marcus@schore.co.uk",  phone: "07700 900102", role: "Manager", status: "Active",   jobTitle: "Contracts Manager", createdAt: "2024-02-03", lastLogin: "2026-01-22 07:42" },
  { id: "u_003", name: "Florin Vasile",   email: "florin@schore.co.uk",  phone: "07700 900103", role: "Manager", status: "Active",   jobTitle: "Project Manager",   createdAt: "2024-04-19", lastLogin: "2026-01-21 18:30" },
  { id: "u_004", name: "Claudiu Ceausu",  email: "claudiu@schore.co.uk", phone: "07700 900104", role: "User",    status: "Active",   jobTitle: "Site Manager",      createdAt: "2024-06-02", lastLogin: "2026-01-22 06:55" },
  { id: "u_005", name: "Priya Patel",     email: "priya@schore.co.uk",   phone: "07700 900105", role: "User",    status: "Active",   jobTitle: "Site Manager",      createdAt: "2024-09-14", lastLogin: "2026-01-20 16:11" },
  { id: "u_006", name: "Tom Wright",      email: "tom@schore.co.uk",     phone: "07700 900106", role: "User",    status: "Inactive", jobTitle: "Site Manager",      createdAt: "2024-11-08", lastLogin: "2025-12-14 09:02" },
];

let users: AppUser[] = [...seed];
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

export const usersStore = {
  getAll: () => users,
  get: (id: string) => users.find(u => u.id === id),
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
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useUsers() {
  return useSyncExternalStore(
    usersStore.subscribe,
    usersStore.getAll,
    usersStore.getAll,
  );
}

export const ROLES: UserRole[] = ["Admin", "Manager", "User"];

export const ROLE_BADGE: Record<UserRole, string> = {
  Admin:   "bg-destructive/10 text-destructive border-destructive/20",
  Manager: "bg-info/10 text-info border-info/20",
  User:    "bg-muted text-foreground/70 border-border",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  Admin:   "Full access · user management, rates, billing",
  Manager: "Edit operatives, properties, rates, wages",
  User:    "View-only on rates · daily ticking & site updates",
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

  if (input.phone && input.phone.trim() && !/^[\d +()-]{7,20}$/.test(input.phone.trim())) {
    errs.phone = "Enter a valid phone number";
  }
  return errs;
}
