import { type ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormDescription, FormControl } from "@/components/ui/form";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

export interface PhoneNumberFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Static country dial code shown on the left (e.g. "+44"). */
  dialCode?: string;
  /** Small flag text shown on the left (e.g. "🇬🇧"). */
  flag?: string;
}

export function PhoneNumberField<T extends FieldValues>({
  name,
  label,
  description,
  disabled,
  className,
  placeholder,
  dialCode: _dialCode,
  flag: _flag,
}: PhoneNumberFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string) ?? "";
        // react-phone-number-input expects E.164 format (e.g. "+447700900000") or empty string.
        const phoneValue = value.trim() ? value.trim() : "";

        const containerClass = cn(
          "w-full",
          "[&_.PhoneInput]:flex [&_.PhoneInput]:h-9 [&_.PhoneInput]:w-full [&_.PhoneInput]:items-center [&_.PhoneInput]:rounded-md [&_.PhoneInput]:border [&_.PhoneInput]:border-input [&_.PhoneInput]:bg-transparent [&_.PhoneInput]:px-3 [&_.PhoneInput]:py-1 [&_.PhoneInput]:text-sm [&_.PhoneInput]:shadow-sm [&_.PhoneInput]:transition-colors [&_.PhoneInput]:focus-within:outline-none [&_.PhoneInput]:focus-within:ring-1 [&_.PhoneInput]:focus-within:ring-ring",
          "[&_.PhoneInputInput]:h-full [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:px-2 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:outline-none",
          "[&_.PhoneInputCountry]:mr-2 [&_.PhoneInputCountry]:flex [&_.PhoneInputCountry]:items-center [&_.PhoneInputCountry]:gap-2",
          "[&_.PhoneInputCountrySelectArrow]:ml-1 [&_.PhoneInputCountrySelectArrow]:opacity-60",
          fieldState.error
            ? "[&_.PhoneInput]:border-destructive [&_.PhoneInput]:focus-within:ring-destructive"
            : "",
        );
        return (
          <FormItem className={className}>
            {label && <FormLabel>{label}</FormLabel>}

            <FormControl>
              <div className={containerClass}>
                <PhoneInput
                  international
                  defaultCountry="GB"
                  value={phoneValue as string | undefined}
                  onChange={(v) => field.onChange(v ?? "")}
                  disabled={disabled || submitting}
                  placeholder={placeholder ?? "07700 900000"}
                  aria-invalid={!!fieldState.error}
                  className={cn("PhoneInput", disabled || submitting ? "opacity-50" : "")}
                />
              </div>
            </FormControl>

            {description && <FormDescription>{description}</FormDescription>}
          </FormItem>
        );
      }}
    />
  );
}
