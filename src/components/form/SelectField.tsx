import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { FormFieldLabel } from "@/components/form/FormFieldLabel";
import { shouldShowFieldError } from "@/components/form/shouldShowFieldError";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function SelectField<T extends FieldValues>({
  name, label, description, required, placeholder, options,
  disabled, className, triggerClassName,
}: SelectFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue = field.value == null ? "" : String(field.value);
        // Only pass values that exist in options — Radix clears unmatched values.
        const selectedValue =
          rawValue && options.some((o) => String(o.value) === rawValue) ? rawValue : undefined;
        const invalid = shouldShowFieldError(fieldState.error, formState.isSubmitted);
        return (
          <FormItem className={className}>
            {label && (
              <FormFieldLabel label={label} description={description} required={required} />
            )}
            <Select
              key={`${selectedValue ?? "empty"}:${options.map((o) => o.value).join(",")}`}
              value={selectedValue}
              onValueChange={field.onChange}
              disabled={disabled || submitting}
            >
              <FormControl>
                <SelectTrigger
                  aria-required={required}
                  aria-invalid={invalid}
                  className={cn(
                    invalid && "border-destructive focus-visible:ring-destructive",
                    triggerClassName,
                  )}
                >
                  <SelectValue placeholder={placeholder ?? "Select…"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem
                    key={o.value}
                    value={String(o.value)}
                    disabled={o.disabled}
                    description={o.description}
                  >
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        );
      }}
    />
  );
}
