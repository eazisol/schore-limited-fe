import type { ApiTaskItem } from "@/lib/api/services/tasks";
import type { ApiDailyItemOption } from "@/lib/api/services/daily-programme";

function workDateIso(item: ApiTaskItem) {
  return item.workDate.slice(0, 10);
}

function sameItemLine(a: ApiTaskItem, b: ApiTaskItem) {
  return (
    a.operativeId === b.operativeId &&
    a.tradeId === b.tradeId &&
    a.tradeGroupId === b.tradeGroupId &&
    a.productId === b.productId
  );
}

function itemLabel(item: ApiTaskItem) {
  return item.tradeGroupName?.trim() || item.productName?.trim() || item.tradeName?.trim() || "Work line";
}

/** Client-side mirror of DailyProgrammeService item pool logic. */
export function buildDailyItemOptions(items: ApiTaskItem[], date: string): ApiDailyItemOption[] {
  const itemsUpToDate = items.filter((item) => workDateIso(item) <= date);
  const todayItems = itemsUpToDate.filter((item) => workDateIso(item) === date);
  const priorItems = itemsUpToDate.filter((item) => workDateIso(item) < date);

  let pool: ApiTaskItem[];
  if (priorItems.length > 0) {
    const latestDate = priorItems.reduce(
      (max, item) => (workDateIso(item) > max ? workDateIso(item) : max),
      "",
    );
    pool = priorItems.filter((item) => workDateIso(item) === latestDate);
  } else {
    pool = [...todayItems];
  }

  for (const today of todayItems) {
    if (!pool.some((entry) => sameItemLine(entry, today))) {
      pool.push(today);
    }
  }

  return pool
    .map((poolItem) => {
      const todayMatch = todayItems.find((entry) => sameItemLine(entry, poolItem));
      return {
        sourceItemId: poolItem.id,
        todayItemId: todayMatch?.id ?? null,
        label: itemLabel(poolItem),
        operativeName: poolItem.operativeName,
        isSelected: todayMatch != null,
        isTicked: todayMatch?.isTicked ?? false,
      };
    })
    .sort((a, b) => {
      const byOperative = a.operativeName.localeCompare(b.operativeName, undefined, {
        sensitivity: "base",
      });
      if (byOperative !== 0) return byOperative;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
}

export function dailyItemSelectionSummary(options: ApiDailyItemOption[]) {
  const selected = options.filter((option) => option.isSelected).map((option) => option.label);
  if (selected.length === 0) {
    return options.length === 0 ? "No items" : "Select items";
  }
  if (selected.length === 1) return selected[0];
  return `${selected.length} items`;
}

export function dailyItemSelectionDetail(options: ApiDailyItemOption[]) {
  const selected = options.filter((option) => option.isSelected).map((option) => option.label);
  if (selected.length > 0) return selected.join(", ");
  if (options.length === 0) return "No items available for this task";
  return "No items selected for today";
}
