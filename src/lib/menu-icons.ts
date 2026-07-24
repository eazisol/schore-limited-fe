import { icons, Circle, type LucideIcon } from "lucide-react";

/**
 * Non-Lucide / legacy API icon keys → Lucide component names.
 * Prefer sending the Lucide kebab-case name from the API (e.g. `handshake`, `hard-hat`)
 * so new menus do not need a frontend change.
 */
const ICON_ALIASES: Record<string, keyof typeof icons> = {
  dashboard: "LayoutDashboard",
  setting: "Settings",
  menus: "Menu",
  permissions: "KeyRound",
  permission: "KeyRound",
  shield: "ShieldCheck",
  roles: "ShieldCheck",
  reports: "FileText",
  properties: "Building2",
  contracts: "Briefcase",
  payroll: "Banknote",
  items: "Tags",
  item: "Tags",
  rates: "Tags",
  grid: "LayoutGrid",
  products: "Package",
  product: "Package",
  "product-management": "Package",
  product_management: "Package",
  trades: "Wrench",
  trade: "Wrench",
  "trade-builder": "Wrench",
  cis: "Percent",
  "cis-management": "Percent",
  operatives: "HardHat",
  operative: "HardHat",
};

function toKebabKey(icon: string): string {
  return icon.trim().toLowerCase().replace(/\s+/g, "-");
}

/** `hard-hat` / `hard_hat` → `HardHat` */
function toPascalCase(icon: string): string {
  return icon
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/**
 * Resolve a menu API `icon` string to a Lucide component.
 * Supports any Lucide icon by kebab-case name (e.g. `handshake` → Handshake).
 * Unknown values fall back to Circle.
 */
export function resolveMenuIcon(icon: string | null | undefined): LucideIcon | null {
  if (!icon?.trim()) return null;

  const kebab = toKebabKey(icon);
  const alias = ICON_ALIASES[kebab];
  if (alias && icons[alias]) {
    return icons[alias] as LucideIcon;
  }

  const pascal = toPascalCase(kebab) as keyof typeof icons;
  if (icons[pascal]) {
    return icons[pascal] as LucideIcon;
  }

  return Circle;
}
