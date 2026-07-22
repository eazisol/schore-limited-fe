import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { useRef, type ComponentType, type InputHTMLAttributes, type ReactNode } from "react";
import { Calendar } from "lucide-react";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AppTooltip } from "@/components/AppTooltip";
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
  /** Transform the string value on change (e.g. uppercase Code fields). */
  transformValue?: (value: string) => string;
}

function dateTooltipLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Select date";
  const d = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TextField<T extends FieldValues>({
  name, label, description, required, leftIcon: Icon, rightSlot,
  className, inputClassName, disabled, type, transformValue, ...rest
}: TextFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  const isDateField = type === "date";
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const dateLabel = dateTooltipLabel(String(field.value ?? ""));
        return (
          <FormItem className={className}>
            {label && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
              </FormLabel>
            )}
            <div className="relative">
              {Icon && (
                <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <FormControl>
                <Input
                  {...rest}
                  type={type}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    if (transformValue && type !== "number") {
                      field.onChange(transformValue(event.target.value));
                      return;
                    }
                    field.onChange(event);
                  }}
                  value={field.value ?? ""}
                  ref={(el) => {
                    field.ref(el);
                    inputRef.current = el;
                  }}
                  aria-required={required}
                  aria-invalid={!!fieldState.error}
                  disabled={disabled || submitting}
                  className={cn(
                    Icon && "pl-9",
                    (rightSlot || isDateField) && "pr-10",
                    isDateField &&
                      "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
                    fieldState.error && "border-destructive focus-visible:ring-destructive",
                    inputClassName,
                  )}
                />
              </FormControl>
              {isDateField && (
                <AppTooltip content={dateLabel} asChild>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={dateLabel}
                    disabled={disabled || submitting}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground disabled:opacity-50"
                    onClick={() => {
                      const el = inputRef.current;
                      if (!el || disabled || submitting) return;
                      try {
                        el.showPicker?.();
                      } catch {
                        el.focus();
                        el.click();
                      }
                    }}
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                </AppTooltip>
              )}
              {rightSlot && (
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
                  {rightSlot}
                </div>
              )}
            </div>
            {description && <FormDescription>{description}</FormDescription>}
          </FormItem>
        );
      }}
    />
  );
}
