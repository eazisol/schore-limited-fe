import type {
  ApiDailyAssignedOperative,
  ApiDailyNameOperative,
  ApiDailyUnassignedAddOn,
  ApiDailyUnassignedPackage,
} from "@/lib/api/services/daily-programme";
import { isRateApprovalOpen } from "@/lib/rate-approval";

/** Drop pending/rejected rate lines so Name/Items only reflect approved assignments. */
export function filterAssignedGroupsWithoutOpenApprovals(
  groups: ApiDailyAssignedOperative[],
): ApiDailyAssignedOperative[] {
  return groups
    .map((op) => ({
      ...op,
      packages: op.packages
        .map((pkg) => ({
          ...pkg,
          items: pkg.items.filter((item) => !isRateApprovalOpen(item.rateApprovalStatus)),
        }))
        .filter((pkg) => pkg.items.length > 0),
      addOns: op.addOns.filter((item) => !isRateApprovalOpen(item.rateApprovalStatus)),
    }))
    .filter((op) => op.packages.length > 0 || op.addOns.length > 0);
}

export function filterNameOperativesWithoutOpenApprovals(
  operatives: ApiDailyNameOperative[],
): ApiDailyNameOperative[] {
  return operatives
    .map((op) => ({
      ...op,
      // Keep every completed line; only hide open work still blocked on rate approval.
      items: (op.items ?? []).filter(
        (item) =>
          Boolean(item.isTicked) || !isRateApprovalOpen(item.rateApprovalStatus),
      ),
    }))
    .filter((op) => op.items.length > 0);
}

export function dailyAssignmentSummary(groups: ApiDailyAssignedOperative[]) {
  const visible = filterAssignedGroupsWithoutOpenApprovals(groups);
  const names: string[] = [];
  for (const group of visible) {
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
  const visible = filterAssignedGroupsWithoutOpenApprovals(groups);
  const names: string[] = [];
  for (const group of visible) {
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
