import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { FormFieldLabel } from "@/components/form/FormFieldLabel";
import { shouldShowFieldError } from "@/components/form/shouldShowFieldError";
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
  /**
   * Always-visible top option (e.g. "None" for optional fields).
   * Use an empty string value for the clear state.
   */
  emptyOption?: SearchableSelectOption;
  /** Called when the user picks an option (value + label). */
  onSelect?: (option: SearchableSelectOption) => void;
  /** When set, shows an "Add" action at the bottom of the dropdown list. */
  onAddNew?: () => void;
  /** Label for the add action. Defaults to "Add new". */
  addNewLabel?: string;
  /** When true, shows a clear option while a value is selected. Defaults to !required. */
  clearable?: boolean;
  /** Label for the clear option. Defaults to "Clear selection". */
  clearLabel?: string;
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
  emptyOption,
  onSelect,
  onAddNew,
  addNewLabel,
  clearable,
  clearLabel,
}: SearchableSelectFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue = field.value == null ? "" : String(field.value);
        const invalid = shouldShowFieldError(fieldState.error, formState.isSubmitted);

        return (
          <FormItem className={className}>
            {label && (
              <FormFieldLabel label={label} description={description} required={required} />
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
                emptyOption={emptyOption}
                onSelect={onSelect}
                onAddNew={onAddNew}
                addNewLabel={addNewLabel}
                clearable={clearable ?? !required}
                clearLabel={clearLabel}
                invalid={invalid}
                triggerClassName={triggerClassName}
                aria-label={typeof label === "string" ? label : undefined}
              />
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}
