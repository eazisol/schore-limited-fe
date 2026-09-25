/** Backend menu route for Roles (permission checks & navigation). */
export const ROLES_ROUTE = "/roles";

/** Backend menu code for the Roles list page (child of User Management). */
export const ROLES_CODE = "ROLE_LIST";

/** Backend role code for Labour Planner. */
export const ROLE_LABOUR_PLANNER = "LP";

export function hasRoleCode(
  roles: string[] | null | undefined,
  code: string,
): boolean {
  const needle = code.trim().toUpperCase();
  if (!needle) return false;
  return (roles ?? []).some((r) => r.trim().toUpperCase() === needle);
}

export function isLabourPlanner(roles: string[] | null | undefined): boolean {
  return hasRoleCode(roles, ROLE_LABOUR_PLANNER);
}
