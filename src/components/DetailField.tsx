import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section title for detail/view pages — visually distinct from field labels and values. */
export function DetailSectionHeading({
  children,
  className,
  icon: Icon,
}: {
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <h3
      className={cn(
        "flex items-center gap-2 border-b border-border pb-3 font-display text-base font-semibold tracking-tight text-foreground sm:text-lg",
        className,
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      {children}
    </h3>
  );
}

/** Label + value stack for detail/view pages. */
export function DetailField({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex items-center gap-1.5 text-base font-semibold text-foreground">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
        {label}
      </div>
      <div className="break-words text-sm font-normal leading-relaxed text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

/** Horizontal label/value row for Record / Account side panels. */
export function DetailMetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="shrink-0 text-base font-semibold text-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-normal text-muted-foreground">{children}</dd>
    </div>
  );
}
