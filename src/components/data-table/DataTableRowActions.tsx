import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppTooltip } from "@/components/AppTooltip";
import type { DataTableRowAction } from "./types";

export function DataTableRowActions<T>({
  row,
  actions,
  align = "right",
}: {
  row: T;
  actions: DataTableRowAction<T>[];
  align?: "left" | "right";
}) {
  const visible = actions.filter((action) => !action.hidden?.(row));
  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        align === "left" ? "justify-start" : "justify-end",
      )}
    >
      {visible.map((action) => {
        const isApprove = action.variant === "approve" || action.id === "approve";
        const isReject =
          action.variant === "reject" || (action.id === "reject" && action.variant !== "icon");
        const hasLabel =
          isApprove || isReject || action.variant === "button" || action.variant === "badge";

        if (isApprove) {
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => action.onClick(row)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50",
                action.className,
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          );
        }

        if (isReject) {
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => action.onClick(row)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50",
                action.className,
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          );
        }

        if (hasLabel) {
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => action.onClick(row)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent/40 transition-colors",
                action.danger && "border-destructive/30 text-destructive hover:bg-destructive/10",
                action.className,
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          );
        }

        return (
          <ActionIconButton
            key={action.id}
            label={action.label}
            danger={action.danger}
            onClick={() => action.onClick(row)}
          >
            {action.icon}
          </ActionIconButton>
        );
      })}
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
          "inline-grid h-7 w-7 place-items-center rounded-md cursor-pointer hover:bg-accent/40",
          danger && "text-destructive hover:bg-destructive/10",
        )}
      >
        {children}
      </button>
    </AppTooltip>
  );
}
