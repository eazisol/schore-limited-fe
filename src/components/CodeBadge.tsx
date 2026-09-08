import type { ReactNode } from "react";
import { splitCodeAndLabel } from "@/lib/code-display";
import { cn } from "@/lib/utils";

export function CodeBadge({ code, className }: { code?: string | null; className?: string }) {
  const trimmed = code?.trim();
  if (!trimmed) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <code
      className={cn(
        "inline-block max-w-full whitespace-nowrap rounded bg-secondary px-1.5 py-0.5 font-mono text-xs",
        className,
      )}
    >
      {trimmed}
    </code>
  );
}

export function CodeWithLabel({
  code,
  label,
  combined,
  className,
}: {
  code?: string | null;
  label?: string | null;
  combined?: string | null;
  className?: string;
}) {
  const parts = combined
    ? splitCodeAndLabel(combined)
    : { code: code?.trim() || undefined, label: label?.trim() || undefined };
  const displayCode = parts.code;
  const displayLabel = parts.label;

  if (!displayCode && !displayLabel) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {displayCode ? <CodeBadge code={displayCode} /> : null}
      {displayLabel ? <span>{displayLabel}</span> : null}
    </span>
  );
}

export function codeHighlightValue(code?: string | null): ReactNode {
  return <CodeBadge code={code} />;
}
