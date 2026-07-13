import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
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
}

export function TextareaField<T extends FieldValues>({
  name, label, description, required, className, textareaClassName, disabled, ...rest
}: TextareaFieldProps<T>) {
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
          <FormControl>
            <Textarea
              {...rest}
              {...field}
              value={field.value ?? ""}
              aria-required={required}
              aria-invalid={!!fieldState.error}
              disabled={disabled || submitting}
              className={cn(
                fieldState.error && "border-destructive focus-visible:ring-destructive",
                textareaClassName,
              )}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
