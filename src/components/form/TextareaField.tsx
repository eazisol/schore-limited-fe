import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
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
        return (
          <FormItem className={className}>
            {label && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
              </FormLabel>
            )}
            <FormControl>
              <Textarea
                {...rest}
                {...field}
                value={value}
                maxLength={maxLength}
                aria-required={required}
                aria-invalid={!!fieldState.error}
                disabled={disabled || submitting}
                className={cn(
                  fieldState.error && "border-destructive focus-visible:ring-destructive",
                  textareaClassName,
                )}
              />
            </FormControl>
            {(description || shouldShowCount) && (
              <div className="flex items-start justify-between gap-3">
                {description ? (
                  <FormDescription>{description}</FormDescription>
                ) : (
                  <span />
                )}
                {shouldShowCount && maxLength != null && (
                  <p
                    className={cn(
                      "shrink-0 text-xs tabular-nums text-muted-foreground",
                      used >= maxLength && "text-destructive",
                    )}
                    aria-live="polite"
                  >
                    {used} / {maxLength}
                  </p>
                )}
              </div>
            )}
          </FormItem>
        );
      }}
    />
  );
}
