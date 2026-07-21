import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Settings,
  ShieldCheck,
  Menu,
  KeyRound,
  Circle,
  LayoutGrid,
  FileText,
  Building2,
  Briefcase,
  Banknote,
  Tags,
  Package,
  Wrench,
  Percent,
  HardHat,
} from "lucide-react";

/**
 * Maps API `icon` string values to Lucide components.
 * Unknown icons fall back to a neutral glyph — menus themselves are never hardcoded.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  user: Users,
  settings: Settings,
  setting: Settings,
  menus: Menu,
  menu: Menu,
  permissions: KeyRound,
  permission: KeyRound,
  shield: ShieldCheck,
  roles: ShieldCheck,
  reports: FileText,
  properties: Building2,
  contracts: Briefcase,
  payroll: Banknote,
  items: Tags,
  item: Tags,
  rates: Tags,
  grid: LayoutGrid,
  products: Package,
  product: Package,
  package: Package,
  "product-management": Package,
  product_management: Package,
  trades: Wrench,
  trade: Wrench,
  "trade-builder": Wrench,
  wrench: Wrench,
  cis: Percent,
  "cis-management": Percent,
  percent: Percent,
  operatives: HardHat,
  operative: HardHat,
  "hard-hat": HardHat,
};

export function resolveMenuIcon(icon: string | null | undefined): LucideIcon {
  if (!icon) return Circle;
  const key = icon.trim().toLowerCase().replace(/\s+/g, "-");
  return ICON_MAP[key] ?? Circle;
}
