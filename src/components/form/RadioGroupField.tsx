import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  required?: boolean;
  options: RadioOption[];
  layout?: "stack" | "grid" | "row";
  disabled?: boolean;
  className?: string;
}

export function RadioGroupField<T extends FieldValues>({
  name, label, required, options, layout = "stack", disabled, className,
}: RadioGroupFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
            </FormLabel>
          )}
          <FormControl>
            <RadioGroup
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled || submitting}
              className={cn(
                layout === "grid" && "grid grid-cols-1 sm:grid-cols-3 gap-3",
                layout === "row" && "flex flex-wrap gap-3",
                layout === "stack" && "space-y-2",
              )}
            >
              {options.map(o => {
                const id = `${name}-${o.value}`;
                return (
                  <label
                    key={o.value}
                    htmlFor={id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-md border border-input p-3 cursor-pointer transition-colors hover:bg-accent/5",
                      field.value === o.value && "border-accent bg-accent/5",
                      o.disabled && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <RadioGroupItem id={id} value={o.value} disabled={o.disabled} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{o.label}</div>
                      {o.description && <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{o.description}</div>}
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
