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
}

export function SwitchField<T extends FieldValues>({
  name,
  label,
  disabled,
  className,
}: SwitchFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            "flex h-9 items-center justify-start gap-3 space-y-0 self-end",
            className,
          )}
        >
          <FormLabel className="cursor-pointer font-medium">{label}</FormLabel>
          <FormControl>
            <Switch
              checked={!!field.value}
              onCheckedChange={field.onChange}
              disabled={disabled || submitting}
              aria-label={typeof label === "string" ? label : undefined}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
