import type {
  ApiDailyAssignedOperative,
  ApiDailyUnassignedAddOn,
  ApiDailyUnassignedPackage,
} from "@/lib/api/services/daily-programme";

export function dailyAssignmentSummary(groups: ApiDailyAssignedOperative[]) {
  const names: string[] = [];
  for (const group of groups) {
    for (const pkg of group.packages) {
      names.push(pkg.tradeGroupName);
    }
    for (const addOn of group.addOns) {
      names.push(addOn.productName);
    }
  }
  if (names.length === 0) return "No items";
  const unique = [...new Set(names)];
  if (unique.length === 1) return unique[0];
  return `${unique.length} items`;
}

export function dailyAssignmentDetail(groups: ApiDailyAssignedOperative[]) {
  const names: string[] = [];
  for (const group of groups) {
    for (const pkg of group.packages) {
      names.push(pkg.tradeGroupName);
    }
    for (const addOn of group.addOns) {
      names.push(addOn.productName);
    }
  }
  const unique = [...new Set(names)];
  if (unique.length === 0) return "No packages or add-ons assigned";
  return unique.join(", ");
}

export function filterUnassignedPackages(
  packages: ApiDailyUnassignedPackage[],
  search: string,
) {
  const q = search.trim().toLowerCase();
  if (!q) return packages;
  return packages.filter(
    (p) =>
      p.tradeGroupName.toLowerCase().includes(q) ||
      (p.tradeName?.toLowerCase().includes(q) ?? false),
  );
}

export function filterUnassignedAddOns(
  addOns: ApiDailyUnassignedAddOn[],
  search: string,
) {
  const q = search.trim().toLowerCase();
  if (!q) return addOns;
  return addOns.filter((a) => a.productName.toLowerCase().includes(q));
}
