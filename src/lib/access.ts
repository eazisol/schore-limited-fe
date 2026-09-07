export const CAPABILITY_CODES = {
  seeRates: "SEE_RATES",
  selectRateItems: "SELECT_RATE_ITEMS",
  createTaskItems: "CREATE_TASK_ITEMS",
  editTaskDescriptions: "EDIT_TASK_DESCRIPTIONS",
  editTaskPrices: "EDIT_TASK_PRICES",
  approveRateChanges: "APPROVE_RATE_CHANGES",
  overrideRates: "OVERRIDE_RATES",
  viewWageTotals: "VIEW_WAGE_TOTALS",
  exportPaymentReports: "EXPORT_PAYMENT_REPORTS",
} as const;

export type CapabilityCode = (typeof CAPABILITY_CODES)[keyof typeof CAPABILITY_CODES];

export function hasCapability(
  capabilities: readonly string[] | undefined,
  code: string,
): boolean {
  if (!capabilities?.length) return false;
  return capabilities.some((item) => item.toUpperCase() === code.toUpperCase());
}
