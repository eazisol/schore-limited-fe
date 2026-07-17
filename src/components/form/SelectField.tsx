import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
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
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
            </FormLabel>
          )}
          <Select
            value={field.value ?? ""}
            onValueChange={field.onChange}
            disabled={disabled || submitting}
          >
            <FormControl>
              <SelectTrigger
                aria-required={required}
                aria-invalid={!!fieldState.error}
                className={cn(
                  fieldState.error && "border-destructive focus-visible:ring-destructive",
                  triggerClassName,
                )}
              >
                <SelectValue placeholder={placeholder ?? "Select…"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map(o => (
                <SelectItem
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  description={o.description}
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
        </FormItem>
      )}
    />
  );
}
