import type { ApiCapabilityDefinition } from "@/lib/api/services/access";
import type { ApiCapabilityOverride } from "@/lib/api/services/users";

export function isCeoRole(code?: string | null): boolean {
  return code?.trim().toUpperCase() === "CEO";
}

export function hasCeoRole(roleCodes?: string[] | null): boolean {
  return roleCodes?.some((code) => isCeoRole(code)) ?? false;
}

export function sameCapabilityOverrides(
  left: ApiCapabilityOverride[],
  right: ApiCapabilityOverride[],
): boolean {
  if (left.length !== right.length) return false;
  const rightMap = new Map(right.map((item) => [item.code.toUpperCase(), item.isGranted]));
  return left.every((item) => rightMap.get(item.code.toUpperCase()) === item.isGranted);
}

export function mergeCapabilityRows(
  roleItems: ApiCapabilityDefinition[],
  overrides: ApiCapabilityOverride[],
  ceo = false,
): Array<ApiCapabilityDefinition & { isOverride: boolean }> {
  const overrideMap = new Map(
    overrides.map((item) => [item.code.toUpperCase(), item.isGranted] as const),
  );

  return roleItems.map((item) => {
    const key = item.code.toUpperCase();
    const isOverride = !ceo && overrideMap.has(key);
    return {
      ...item,
      isGranted: ceo ? true : isOverride ? Boolean(overrideMap.get(key)) : item.isGranted,
      isOverride,
    };
  });
}

export function setCapabilityOverride(
  overrides: ApiCapabilityOverride[],
  code: string,
  nextGranted: boolean,
  roleGranted: boolean,
): ApiCapabilityOverride[] {
  const others = overrides.filter((item) => item.code.toUpperCase() !== code.toUpperCase());
  if (nextGranted === roleGranted) return others;
  return [...others, { code, isGranted: nextGranted }];
}

export function pruneCapabilityOverrides(
  overrides: ApiCapabilityOverride[],
  roleItems: ApiCapabilityDefinition[],
): ApiCapabilityOverride[] {
  const roleMap = new Map(
    roleItems.map((item) => [item.code.toUpperCase(), item.isGranted] as const),
  );
  return overrides.filter((item) => item.isGranted !== (roleMap.get(item.code.toUpperCase()) ?? false));
}

export function overridesFromGrantedCodes(
  grantedCodes: string[],
  roleItems: ApiCapabilityDefinition[],
): ApiCapabilityOverride[] {
  const granted = new Set(grantedCodes.map((code) => code.toUpperCase()));
  return roleItems
    .filter((item) => granted.has(item.code.toUpperCase()) !== item.isGranted)
    .map((item) => ({
      code: item.code,
      isGranted: granted.has(item.code.toUpperCase()),
    }));
}
