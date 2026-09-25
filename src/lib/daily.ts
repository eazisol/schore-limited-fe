/** Backend menu route for Daily Programmer. */
export const DAILY_ROUTE = "/daily";

/** Backend menu code for Daily Programmer. */
export const DAILY_CODE = "DAILY";

/** User-facing label for the Daily Programmer module. */
export const DAILY_LABEL = "Daily Programmer";

export type DailyItemAddBlockInput = {
  /** Row / job is locked until previous working day is ticked. */
  isLocked?: boolean;
  /**
   * Selected programme date is before today.
   * Past views still allow assign (to today); only lock/permission block select.
   * Kept for callers that surface past-day messaging separately.
   */
  isPast?: boolean;
  /** Capability: SelectRateItems. */
  canSelectRateItems?: boolean;
  /** Menu modify on Daily. */
  canModify?: boolean;
};

/** Why new task-item assign/add is blocked — null when allowed. */
export function resolveDailyItemAddBlockReason(
  input: DailyItemAddBlockInput,
): string | null {
  if (input.canModify === false) {
    return "You don't have permission to assign or edit items.";
  }
  if (input.canSelectRateItems === false) {
    return "You don't have permission to select rate items.";
  }
  // Past programme date does not block — unlocked jobs assign for today.
  if (input.isLocked) {
    return "Locked — tick at least one item on the previous working day before adding new items.";
  }
  return null;
}
