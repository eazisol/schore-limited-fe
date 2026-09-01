import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { FormFieldLabel } from "@/components/form/FormFieldLabel";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface CheckboxFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function CheckboxField<T extends FieldValues>({
  name, label, description, disabled, className,
}: CheckboxFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex flex-row items-center gap-2.5 space-y-0", className)}>
          <FormControl>
            <Checkbox
              checked={!!field.value}
              onCheckedChange={v => field.onChange(v === true)}
              disabled={disabled || submitting}
              aria-label={typeof label === "string" ? label : undefined}
            />
          </FormControl>
          <div className="leading-none">
            <FormFieldLabel label={label} description={description} subdued />
          </div>
        </FormItem>
      )}
    />
  );
}
