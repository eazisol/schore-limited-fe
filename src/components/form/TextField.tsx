import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TextFieldProps<T extends FieldValues>
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "form"> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  leftIcon?: ComponentType<{ className?: string }>;
  rightSlot?: ReactNode;
  inputClassName?: string;
}

export function TextField<T extends FieldValues>({
  name, label, description, required, leftIcon: Icon, rightSlot,
  className, inputClassName, disabled, ...rest
}: TextFieldProps<T>) {
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
          <div className="relative">
            {Icon && (
              <Icon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            )}
            <FormControl>
              <Input
                {...rest}
                {...field}
                value={field.value ?? ""}
                aria-required={required}
                aria-invalid={!!fieldState.error}
                disabled={disabled || submitting}
                className={cn(
                  Icon && "pl-9",
                  rightSlot && "pr-10",
                  fieldState.error && "border-destructive focus-visible:ring-destructive",
                  inputClassName,
                )}
              />
            </FormControl>
            {rightSlot && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                {rightSlot}
              </div>
            )}
          </div>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
