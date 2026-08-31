import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { FormLabel, FormDescription } from "@/components/ui/form";
import { AppTooltip } from "@/components/AppTooltip";
import { cn } from "@/lib/utils";

function descriptionAriaLabel(description: ReactNode): string {
  if (typeof description === "string") return description;
  if (typeof description === "number") return String(description);
  return "Field help";
}

export function FormFieldHint({ description }: { description: ReactNode }) {
  if (!description) return null;

  return (
    <>
      <AppTooltip content={description} side="top">
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={descriptionAriaLabel(description)}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </AppTooltip>
      <FormDescription className="sr-only">{description}</FormDescription>
    </>
  );
}

export interface FormFieldLabelProps {
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  /** When true, label uses normal font weight (e.g. checkbox rows). */
  subdued?: boolean;
}

export function FormFieldLabel({
  label,
  description,
  required,
  className,
  subdued,
}: FormFieldLabelProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <FormLabel className={cn(subdued && "cursor-pointer font-normal")}>
        {label}
        {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
      </FormLabel>
      {description && <FormFieldHint description={description} />}
    </div>
  );
}
