import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { FormFieldLabel } from "@/components/form/FormFieldLabel";
import { shouldShowFieldError } from "@/components/form/shouldShowFieldError";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface TextareaFieldProps<T extends FieldValues>
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "form"> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  textareaClassName?: string;
  /** When true (default if `maxLength` is set), show used/max character count. */
  showCount?: boolean;
}

export function TextareaField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  textareaClassName,
  disabled,
  maxLength,
  showCount,
  ...rest
}: TextareaFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  const shouldShowCount = showCount ?? maxLength != null;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = String(field.value ?? "");
        const used = value.length;
        const invalid = shouldShowFieldError(fieldState.error, formState.isSubmitted);
        return (
          <FormItem className={className}>
            {label && (
              <FormFieldLabel label={label} description={description} required={required} />
            )}
            <FormControl>
              <Textarea
                {...rest}
                {...field}
                value={value}
                maxLength={maxLength}
                aria-required={required}
                aria-invalid={invalid}
                disabled={disabled || submitting}
                className={cn(
                  invalid && "border-destructive focus-visible:ring-destructive",
                  textareaClassName,
                )}
              />
            </FormControl>
            {shouldShowCount && maxLength != null && (
              <div className="flex justify-end">
                <p
                  className={cn(
                    "shrink-0 text-xs tabular-nums text-muted-foreground",
                    used >= maxLength && "text-destructive",
                  )}
                  aria-live="polite"
                >
                  {used} / {maxLength}
                </p>
              </div>
            )}
          </FormItem>
        );
      }}
    />
  );
}
