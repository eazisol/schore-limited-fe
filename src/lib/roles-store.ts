import { useSyncExternalStore } from "react";
import { PERMISSION_KEYS, type PermissionKey } from "./permissions";

export type RoleKey = "CEO" | "CM" | "PM" | "SM";

export interface Role {
  key: RoleKey;
  name: string;
  description: string;
  badgeClass: string;
  permissions: PermissionKey[];
  isSystem: boolean; // can't be deleted
}

const STORAGE_KEY = "schore.roles.v1";

// Sensible defaults per the brief
const DEFAULT_PERMS: Record<RoleKey, PermissionKey[]> = {
  CEO: [...PERMISSION_KEYS], // full access
  CM: [
    "users.view", "users.manage",
    "operatives.view", "operatives.manage",
    "prelims.view", "prelims.edit",
    "properties.view", "properties.manage",
    "contracts.view", "contracts.manage",
    "trades.view", "trades.manage",
    "rates.view", "rates.edit",
    "daily.view", "daily.allocate", "daily.confirm",
    "hold.view", "hold.manage", "kpi.view",
    "payroll.view", "payroll.approve",
    "wages.view", "statements.view", "statements.approve",
    "costs.view", "legend.view", "legend.manage",
    "reports.view", "settings.view",
  ],
  PM: [
    "operatives.view", "operatives.manage",
    "prelims.view", "prelims.edit",
    "properties.view",
    "contracts.view",
    "trades.view", "trades.manage",
    "rates.view", "rates.edit",
    "daily.view", "daily.allocate", "daily.confirm",
    "hold.view", "hold.manage", "kpi.view",
    "payroll.view", "payroll.run",
    "wages.view", "statements.view",
    "costs.view", "costs.split", "legend.view",
    "reports.view",
  ],
  SM: [
    "operatives.view",
    "prelims.view",
    "properties.view",
    "trades.view",
    "rates.view", // view £ values only — cannot edit
    "daily.view", "daily.allocate", "daily.confirm",
    "hold.view",
    "kpi.view",
    "wages.view",
    "costs.view", "costs.split",
    "legend.view",
  ],
};

const DEFAULT_ROLES: Role[] = [
  { key: "CEO", name: "CEO",               description: "Full platform access", badgeClass: "bg-destructive/10 text-destructive border-destructive/20", permissions: DEFAULT_PERMS.CEO, isSystem: true },
  { key: "CM",  name: "Contracts Manager", description: "Manage contracts, approve payroll, manage rates", badgeClass: "bg-info/10 text-info border-info/20", permissions: DEFAULT_PERMS.CM, isSystem: true },
  { key: "PM",  name: "Project Manager",   description: "Manage projects, allocate, run payroll", badgeClass: "bg-accent/15 text-accent-foreground border-accent/30", permissions: DEFAULT_PERMS.PM, isSystem: true },
  { key: "SM",  name: "Site Manager",      description: "Allocate, record work, view (but not edit) rates", badgeClass: "bg-muted text-foreground/70 border-border", permissions: DEFAULT_PERMS.SM, isSystem: true },
];

function load(): Role[] {
  if (typeof window === "undefined") return DEFAULT_ROLES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ROLES;
    const parsed = JSON.parse(raw) as Role[];
    // Filter out unknown permission keys (catalogue may have shrunk between deploys)
    return parsed.map(r => ({
      ...r,
      permissions: r.permissions.filter(p => (PERMISSION_KEYS as string[]).includes(p)) as PermissionKey[],
    }));
  } catch {
    return DEFAULT_ROLES;
  }
}

function save(roles: Role[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roles)); } catch {}
}

let roles: Role[] = load();
const listeners = new Set<() => void>();
const emit = () => { save(roles); listeners.forEach(l => l()); };

export const rolesStore = {
  getAll: () => roles,
  get: (key: RoleKey) => roles.find(r => r.key === key),
  setPermissions: (key: RoleKey, perms: PermissionKey[]) => {
    roles = roles.map(r => (r.key === key ? { ...r, permissions: [...new Set(perms)] } : r));
    emit();
  },
  togglePermission: (key: RoleKey, perm: PermissionKey) => {
    roles = roles.map(r => {
      if (r.key !== key) return r;
      const has = r.permissions.includes(perm);
      return { ...r, permissions: has ? r.permissions.filter(p => p !== perm) : [...r.permissions, perm] };
    });
    emit();
  },
  update: (key: RoleKey, patch: Partial<Pick<Role, "name" | "description">>) => {
    roles = roles.map(r => (r.key === key ? { ...r, ...patch } : r));
    emit();
  },
  resetToDefaults: () => {
    roles = DEFAULT_ROLES.map(r => ({ ...r, permissions: [...r.permissions] }));
    emit();
  },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useRoles() {
  return useSyncExternalStore(rolesStore.subscribe, rolesStore.getAll, rolesStore.getAll);
}

export function permissionsForRole(key: RoleKey): Set<PermissionKey> {
  const r = roles.find(x => x.key === key);
  return new Set(r?.permissions ?? []);
}
