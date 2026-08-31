import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormControl, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface SwitchFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Inline label + switch (default), or stacked like text fields in a grid. */
  layout?: "inline" | "stacked";
}

export function SwitchField<T extends FieldValues>({
  name,
  label,
  disabled,
  className,
  layout = "inline",
}: SwitchFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  const stacked = layout === "stacked";
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            stacked
              ? "space-y-2"
              : "flex h-9 items-center justify-start gap-3 space-y-0",
            className,
          )}
        >
          <FormLabel className={cn("font-medium", !stacked && "cursor-pointer")}>
            {label}
          </FormLabel>
          <FormControl>
            <div className={cn(stacked && "flex h-10 items-center")}>
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
                disabled={disabled || submitting}
                aria-label={typeof label === "string" ? label : undefined}
              />
            </div>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
