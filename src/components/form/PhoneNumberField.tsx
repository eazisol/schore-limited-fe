import { type ReactNode, useMemo, useState } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import PhoneInput, { getCountryCallingCode } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import {
  Metadata,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import "react-phone-number-input/style.css";
import { ChevronDown, Globe, Search } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Countries shown before searching (and per search page) — keeps the list light. */
const MAX_VISIBLE_COUNTRIES = 10;

export interface PhoneNumberFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

interface CountryOption {
  value?: string;
  label: string;
}

interface CountrySelectProps {
  value?: string;
  onChange: (value?: string) => void;
  options: CountryOption[];
  disabled?: boolean;
  readOnly?: boolean;
}

function dialCodeFor(country?: string): string {
  if (!country) return "";
  try {
    return `+${getCountryCallingCode(country as never)}`;
  } catch {
    return "";
  }
}

export function getNationalLengthRange(country?: string): { min: number; max: number } {
  if (!country) return { min: 1, max: 15 };
  try {
    const meta = new Metadata();
    meta.selectNumberingPlan(country as CountryCode);
    const lengths = meta.numberingPlan?.possibleLengths() ?? [15];
    return { min: Math.min(...lengths), max: Math.max(...lengths) };
  } catch {
    return { min: 1, max: 15 };
  }
}

/** Max national significant number length for a country (digits after dial code). */
export function getMaxNationalLength(country?: string): number {
  return getNationalLengthRange(country).max;
}

function resolveCountry(value: string, country?: string): CountryCode | undefined {
  if (country) return country as CountryCode;
  return parsePhoneNumberFromString(value)?.country;
}

function nationalDigits(value: string, country: CountryCode): string {
  const digits = value.replace(/\D/g, "");
  const callingCode = String(getCountryCallingCode(country as never));
  if (digits.startsWith(callingCode)) return digits.slice(callingCode.length);
  const parsed = parsePhoneNumberFromString(value, country);
  return parsed?.nationalNumber ?? "";
}

function exceedsCountryMax(value: string, country?: string): boolean {
  const resolvedCountry = resolveCountry(value, country);
  if (!resolvedCountry) return value.replace(/\D/g, "").length > 15;
  return nationalDigits(value, resolvedCountry).length > getMaxNationalLength(resolvedCountry);
}

function valueAfterInsertion(input: HTMLInputElement, inserted: string): string {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  return `${input.value.slice(0, start)}${inserted}${input.value.slice(end)}`;
}

/**
 * Truncate an E.164 phone value so its national number cannot exceed the
 * selected country's maximum possible length.
 */
export function clampPhoneToCountryMax(
  value: string | undefined,
  country?: string,
): string {
  if (!value) return "";

  const resolvedCountry = resolveCountry(value, country);
  if (!resolvedCountry) return value;

  const max = getMaxNationalLength(resolvedCountry);
  let callingCode: string;
  try {
    callingCode = String(getCountryCallingCode(resolvedCountry as never));
  } catch {
    return value;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits.startsWith(callingCode)) return value;

  const national = digits.slice(callingCode.length);
  if (national.length <= max) return value;

  return `+${callingCode}${national.slice(0, max)}`;
}

/** Returns a user-facing error when the phone length/country do not match. */
export function getPhoneLengthError(
  value: string,
  country?: string,
  opts?: { requireMin?: boolean },
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const resolvedCountry = resolveCountry(trimmed, country);
  if (!resolvedCountry) {
    return "Enter a valid phone number for the selected country.";
  }

  const national = nationalDigits(trimmed, resolvedCountry);
  const { min, max } = getNationalLengthRange(resolvedCountry);

  if (national.length > max) {
    return `Phone number cannot exceed ${max} digits for the selected country.`;
  }

  if (opts?.requireMin && national.length > 0 && national.length < min) {
    return `Phone number must be at least ${min} digits for the selected country.`;
  }

  if (national.length >= min) {
    const parsed = parsePhoneNumberFromString(trimmed, resolvedCountry);
    if (parsed && !parsed.isPossible()) {
      return "Enter a valid phone number for the selected country.";
    }
  }

  return null;
}

function CountryFlag({ country, label }: { country?: string; label: string }) {
  const Flag = country ? (flags as Record<string, React.FC<{ title?: string }>>)[country] : undefined;
  return (
    <span className="flex h-4 w-6 items-center justify-center overflow-hidden rounded-[2px]">
      {Flag ? <Flag title={label} /> : <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
    </span>
  );
}

/** Searchable, flag-aware country selector (Select2 style) for the phone input. */
function CountrySelect({ value, onChange, options, disabled, readOnly }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const countries = useMemo(() => options.filter((o) => o.value), [options]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? countries.filter((o) => o.label.toLowerCase().includes(q)) : countries;
    return matched.slice(0, MAX_VISIBLE_COUNTRIES);
  }, [countries, query]);

  const selected = countries.find((o) => o.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled || readOnly) return;
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || readOnly}
          aria-label="Select country"
          className="mr-2 flex items-center gap-1 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          <CountryFlag country={value} label={selected?.label ?? "International"} />
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country"
            className="w-full bg-transparent text-sm outline-none"
            autoFocus
          />
        </div>
        <ul className="max-h-64 overflow-y-auto py-1">
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No countries found</li>
          ) : (
            visible.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent/10",
                      active && "bg-accent/10 font-medium",
                    )}
                  >
                    <CountryFlag country={o.value} label={o.label} />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{dialCodeFor(o.value)}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function makeCountrySelect(onCountrySync: (c?: string) => void) {
  return function SyncedCountrySelect(props: CountrySelectProps) {
    return (
      <CountrySelect
        {...props}
        onChange={(c) => {
          onCountrySync(c);
          props.onChange(c);
        }}
      />
    );
  };
}

export function PhoneNumberField<T extends FieldValues>({
  name,
  label,
  description,
  disabled,
  className,
  placeholder,
}: PhoneNumberFieldProps<T>) {
  const { control, formState, setError, clearErrors } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  const [country, setCountry] = useState<string | undefined>("GB");
  const [touched, setTouched] = useState(false);
  const SyncedCountrySelect = useMemo(() => makeCountrySelect(setCountry), []);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string) ?? "";
        const phoneValue = value.trim() ? value.trim() : "";
        const activeCountry =
          country ?? parsePhoneNumberFromString(phoneValue)?.country ?? "GB";

        const applyValidation = (next: string, selectedCountry?: string) => {
          const err = getPhoneLengthError(next, selectedCountry, { requireMin: touched });
          if (err) setError(name, { type: "custom", message: err });
          else clearErrors(name);
        };

        const containerClass = cn(
          "w-full",
          "[&_.PhoneInput]:flex [&_.PhoneInput]:h-9 [&_.PhoneInput]:w-full [&_.PhoneInput]:items-center [&_.PhoneInput]:rounded-md [&_.PhoneInput]:border [&_.PhoneInput]:border-input [&_.PhoneInput]:bg-transparent [&_.PhoneInput]:px-3 [&_.PhoneInput]:py-1 [&_.PhoneInput]:text-sm [&_.PhoneInput]:shadow-sm [&_.PhoneInput]:transition-colors [&_.PhoneInput]:focus-within:outline-none [&_.PhoneInput]:focus-within:ring-1 [&_.PhoneInput]:focus-within:ring-ring",
          "[&_.PhoneInputInput]:h-full [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:outline-none",
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
                  country={activeCountry as never}
                  onCountryChange={(c) => {
                    setCountry(c);
                    const current = (field.value as string) ?? "";
                    const next = current ? clampPhoneToCountryMax(current, c) : current;
                    if (next !== current) field.onChange(next);
                    applyValidation(next, c);
                  }}
                  flags={flags}
                  countrySelectComponent={SyncedCountrySelect}
                  value={phoneValue as string | undefined}
                  onChange={(v) => {
                    const next = clampPhoneToCountryMax(v ?? "", activeCountry);
                    field.onChange(next);
                    applyValidation(next, activeCountry);
                  }}
                  numberInputProps={{
                    onBeforeInput: (event) => {
                      const inserted = (event.nativeEvent as InputEvent).data;
                      if (!inserted) return;
                      if (exceedsCountryMax(valueAfterInsertion(event.currentTarget, inserted), activeCountry)) {
                        event.preventDefault();
                      }
                    },
                    onPaste: (event) => {
                      const inserted = event.clipboardData.getData("text");
                      if (exceedsCountryMax(valueAfterInsertion(event.currentTarget, inserted), activeCountry)) {
                        event.preventDefault();
                      }
                    },
                    onBlur: () => {
                      field.onBlur();
                      setTouched(true);
                      applyValidation((field.value as string) ?? "", activeCountry);
                    },
                  }}
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
