import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormControl, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

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
        <FormItem className={"flex flex-row items-start gap-2.5 " + (className ?? "")}>
          <FormControl>
            <Checkbox
              checked={!!field.value}
              onCheckedChange={v => field.onChange(v === true)}
              disabled={disabled || submitting}
              aria-label={typeof label === "string" ? label : undefined}
              className="mt-0.5"
            />
          </FormControl>
          <div className="space-y-0.5 leading-tight">
            <FormLabel className="cursor-pointer font-normal">{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}
