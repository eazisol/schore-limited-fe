/** Project-assignable role codes (Contracts / Project / Site Manager). */
export type ProjectAssigneeRoleCode = "CM" | "PM" | "SM";

const ROLE_CODE_RE = /^(.*?)\s*\((CM|PM|SM)\)\s*-\s*.+$/i;

export function isProjectAssigneeRoleCode(value: string): value is ProjectAssigneeRoleCode {
  const upper = value.trim().toUpperCase();
  return upper === "CM" || upper === "PM" || upper === "SM";
}

/**
 * Backend labels look like `Name (PM) - Project Manager`.
 * Split into person name + role code so the UI can show a coloured tag
 * instead of repeating the role title.
 */
export function parseAssignableStaffLabel(raw: string): {
  label: string;
  code?: ProjectAssigneeRoleCode;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { label: "" };

  const match = trimmed.match(ROLE_CODE_RE);
  if (!match) return { label: trimmed };

  const code = match[2].toUpperCase() as ProjectAssigneeRoleCode;
  return { label: match[1].trim() || trimmed, code };
}

export const PROJECT_ASSIGNEE_ROLE_BADGE: Record<ProjectAssigneeRoleCode, string> = {
  CM: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  PM: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  SM: "border-amber-500/30 bg-amber-500/10 text-amber-800",
};

export const PROJECT_ASSIGNEE_ROLE_LABEL: Record<ProjectAssigneeRoleCode, string> = {
  CM: "Contracts Manager",
  PM: "Project Manager",
  SM: "Site Manager",
};
