import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppTooltip } from "@/components/AppTooltip";
import type { DataTableRowAction } from "./types";

export function DataTableRowActions<T>({
  row,
  actions,
}: {
  row: T;
  actions: DataTableRowAction<T>[];
}) {
  const visible = actions.filter((action) => !action.hidden?.(row));
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center justify-end -space-x-0.5">
      {visible.map((action) => (
        <ActionIconButton
          key={action.id}
          label={action.label}
          danger={action.danger}
          onClick={() => action.onClick(row)}
        >
          {action.icon}
        </ActionIconButton>
      ))}
    </div>
  );
}

function ActionIconButton({
  children,
  onClick,
  label,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <AppTooltip content={label} asChild>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "inline-grid h-7 w-7 place-items-center rounded-md hover:bg-accent/40",
          danger && "text-destructive hover:bg-destructive/10",
        )}
      >
        {children}
      </button>
    </AppTooltip>
  );
}
