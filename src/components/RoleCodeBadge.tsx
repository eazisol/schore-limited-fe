import { cn } from "@/lib/utils";
import {
  PROJECT_ASSIGNEE_ROLE_BADGE,
  PROJECT_ASSIGNEE_ROLE_LABEL,
  isProjectAssigneeRoleCode,
  type ProjectAssigneeRoleCode,
} from "@/lib/project-assignee";

export function RoleCodeBadge({
  code,
  className,
}: {
  code?: string | null;
  className?: string;
}) {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed || !isProjectAssigneeRoleCode(trimmed)) return null;

  const role = trimmed as ProjectAssigneeRoleCode;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        PROJECT_ASSIGNEE_ROLE_BADGE[role],
        className,
      )}
      title={PROJECT_ASSIGNEE_ROLE_LABEL[role]}
    >
      {role}
    </span>
  );
}
