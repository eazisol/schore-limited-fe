// Permission catalogue. Single source of truth — add a key here, it appears in the matrix.
// Keys use <resource>.<action> format.

export type PermissionKey = typeof PERMISSIONS[number]["key"];

export const PERMISSIONS = [
  // Users & access
  { key: "users.view",          label: "View users",                 category: "Users & Access" },
  { key: "users.manage",        label: "Create / edit / deactivate users", category: "Users & Access" },
  { key: "roles.manage",        label: "Manage roles",               category: "Users & Access" },
  { key: "permissions.manage",  label: "Edit role permissions matrix", category: "Users & Access" },

  // Workforce
  { key: "operatives.view",     label: "View operatives",            category: "Workforce" },
  { key: "operatives.manage",   label: "Create / edit operatives",   category: "Workforce" },
  { key: "prelims.view",        label: "View prelims",               category: "Workforce" },
  { key: "prelims.edit",        label: "Edit prelims",               category: "Workforce" },

  // Properties & contracts
  { key: "properties.view",     label: "View properties",            category: "Records" },
  { key: "properties.manage",   label: "Create / edit properties",   category: "Records" },
  { key: "contracts.view",      label: "View contracts",             category: "Records" },
  { key: "contracts.manage",    label: "Create / edit contracts",    category: "Records" },

  // Trades
  { key: "trades.view",         label: "View trade builder",         category: "Trades" },
  { key: "trades.manage",       label: "Manage trades / groups / tasks", category: "Trades" },

  // Rates
  { key: "rates.view",          label: "View rate catalogue (incl. £ values)", category: "Rates" },
  { key: "rates.edit",          label: "Edit rate values",           category: "Rates" },

  // Daily ops
  { key: "daily.view",          label: "View daily programme",       category: "Operations" },
  { key: "daily.allocate",      label: "Allocate operatives",        category: "Operations" },
  { key: "daily.confirm",       label: "Confirm completed work",     category: "Operations" },
  { key: "hold.view",           label: "View hold list",             category: "Operations" },
  { key: "hold.manage",         label: "Manage hold list",           category: "Operations" },
  { key: "kpi.view",            label: "View KPI board",             category: "Operations" },

  // Finance
  { key: "payroll.view",        label: "View payroll engine",        category: "Finance" },
  { key: "payroll.run",         label: "Run payroll",                category: "Finance" },
  { key: "payroll.approve",     label: "Approve payroll",            category: "Finance" },
  { key: "wages.view",          label: "View wage sheets",           category: "Finance" },
  { key: "statements.view",     label: "View statements",            category: "Finance" },
  { key: "statements.approve",  label: "Approve statements",         category: "Finance" },
  { key: "costs.view",          label: "View cost & budget",         category: "Finance" },
  { key: "costs.split",         label: "Cost splitting",             category: "Finance" },
  { key: "legend.view",         label: "View legend codes",          category: "Finance" },
  { key: "legend.manage",       label: "Manage legend codes",        category: "Finance" },

  // Misc
  { key: "reports.view",        label: "View reports & exports",     category: "Reports" },
  { key: "settings.view",       label: "View settings",              category: "System" },
  { key: "smtp.manage",         label: "Configure SMTP email",       category: "System" },
] as const;

export const PERMISSION_KEYS = PERMISSIONS.map(p => p.key) as PermissionKey[];

export function groupPermissions() {
  const groups: Record<string, typeof PERMISSIONS[number][]> = {};
  for (const p of PERMISSIONS) {
    (groups[p.category] ??= []).push(p);
  }
  return groups;
}
