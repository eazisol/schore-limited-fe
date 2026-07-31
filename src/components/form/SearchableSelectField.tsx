import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./SearchableSelect";

export type { SearchableSelectOption };

export interface SearchableSelectFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** React Query key prefix for this dropdown. */
  queryKey: readonly unknown[];
  /** Fetch options for the current search term (server-side). */
  fetchOptions: (search: string) => Promise<SearchableSelectOption[]>;
  /**
   * Label for the currently selected value when it may not be in the loaded page
   * (e.g. edit mode with a pre-selected category).
   */
  selectedLabel?: string | null;
  /** Called when the user picks an option (value + label). */
  onSelect?: (option: SearchableSelectOption) => void;
}

export function SearchableSelectField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled,
  className,
  triggerClassName,
  queryKey,
  fetchOptions,
  selectedLabel,
  onSelect,
}: SearchableSelectFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue = field.value == null ? "" : String(field.value);

        return (
          <FormItem className={className}>
            {label && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
              </FormLabel>
            )}
            <FormControl>
              <SearchableSelect
                value={rawValue}
                onValueChange={field.onChange}
                placeholder={placeholder}
                searchPlaceholder={searchPlaceholder}
                disabled={disabled || submitting}
                queryKey={queryKey}
                fetchOptions={fetchOptions}
                selectedLabel={selectedLabel}
                onSelect={onSelect}
                invalid={!!fieldState.error}
                triggerClassName={triggerClassName}
                aria-label={typeof label === "string" ? label : undefined}
              />
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
          </FormItem>
        );
      }}
    />
  );
}
