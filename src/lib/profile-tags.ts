import {
  BadgeCheck,
  BrickWall,
  Briefcase,
  Construction,
  Flame,
  FolderKanban,
  Grid3x3,
  Hammer,
  HardHat,
  Home,
  Layers,
  PaintBucket,
  PaintRoller,
  Shield,
  Shovel,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Icon for an operative trade / designation name. */
export function tradeIconForName(name: string): LucideIcon {
  const key = name.trim().toLowerCase();
  if (/decorat|paint/.test(key)) return PaintRoller;
  if (/plumb/.test(key)) return Wrench;
  if (/electric/.test(key)) return Zap;
  if (/carpent|joiner|joinery|wood/.test(key)) return Hammer;
  if (/tile/.test(key)) return Grid3x3;
  if (/labour|labor/.test(key)) return HardHat;
  if (/plaster|render/.test(key)) return PaintBucket;
  if (/multi/.test(key)) return Layers;
  if (/brick|mason/.test(key)) return BrickWall;
  if (/roof/.test(key)) return Home;
  if (/scaffold/.test(key)) return Construction;
  if (/ground|excavat/.test(key)) return Shovel;
  if (/heat|gas|boiler/.test(key)) return Flame;
  return HardHat;
}

/** Icon for a staff user role / designation name. */
export function roleIconForName(name: string): LucideIcon {
  const key = name.trim().toLowerCase();
  if (/\bceo\b|director|admin/.test(key)) return Shield;
  if (/contract|\bcm\b/.test(key)) return Briefcase;
  if (/project|\bpm\b/.test(key)) return FolderKanban;
  if (/site manager|\bsm\b/.test(key)) return HardHat;
  return BadgeCheck;
}

export function splitTradeNames(
  tradeName?: string | null,
  tradeNames?: string[] | null,
): string[] {
  if (tradeNames?.length) return tradeNames.map((n) => n.trim()).filter(Boolean);
  if (tradeName?.trim()) {
    return tradeName
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
  }
  return [];
}
