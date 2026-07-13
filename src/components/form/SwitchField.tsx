import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormControl, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

export interface SwitchFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SwitchField<T extends FieldValues>({
  name, label, description, disabled, className,
}: SwitchFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={"flex items-center justify-between gap-4 rounded-md border border-input p-3 " + (className ?? "")}>
          <div className="space-y-0.5 min-w-0">
            <FormLabel className="cursor-pointer font-medium">{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </div>
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
