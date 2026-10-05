export const OPERATIVE_VIEW_TABS = [
  "tasks",
  "sites",
  "projects",
  "bank",
  "certificates",
  "rates",
  "wages",
] as const;

export type OperativeViewTab = (typeof OPERATIVE_VIEW_TABS)[number];

export function isOperativeViewTab(value: unknown): value is OperativeViewTab {
  return typeof value === "string" && (OPERATIVE_VIEW_TABS as readonly string[]).includes(value);
}
