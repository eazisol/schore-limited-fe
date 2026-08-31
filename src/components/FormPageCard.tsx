import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppTooltip } from "@/components/AppTooltip";
import { cn } from "@/lib/utils";

export type FormPageBackLink = {
  to: string;
  label: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

export type FormPageBackAction = {
  label: string;
  onClick: () => void;
};

export function FormPageCard({
  title,
  subtitle,
  back,
  onBack,
  headerActions,
  children,
  footer,
  className,
  maxWidth = "max-w-3xl",
}: {
  title: string;
  subtitle?: string;
  back?: FormPageBackLink;
  onBack?: FormPageBackAction;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  const backControl =
    onBack != null ? (
      <AppTooltip content={onBack.label} asChild>
        <button
          type="button"
          onClick={onBack.onClick}
          aria-label={onBack.label}
          className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </AppTooltip>
    ) : back ? (
      <AppTooltip content={back.label} asChild>
        <Link
          to={back.to}
          params={back.params}
          search={back.search}
          aria-label={back.label}
          className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </AppTooltip>
    ) : null;

  return (
    <div className={cn("card-elevated space-y-3 p-4 sm:p-5", maxWidth, className)}>
      <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          {backControl}
          <div className="min-w-0 flex-1">
            <h1 className="break-words font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground sm:truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center justify-end">{headerActions}</div>
        ) : null}
      </div>

      <div className="space-y-3">{children}</div>

      {footer ? (
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
