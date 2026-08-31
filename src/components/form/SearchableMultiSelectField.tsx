import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { FormFieldLabel } from "@/components/form/FormFieldLabel";
import { shouldShowFieldError } from "@/components/form/shouldShowFieldError";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectProps,
} from "./SearchableMultiSelect";
import type { SearchableSelectOption } from "./SearchableSelect";

export type { SearchableSelectOption };

export interface SearchableMultiSelectFieldProps<T extends FieldValues>
  extends Omit<SearchableMultiSelectProps, "value" | "onValueChange" | "invalid" | "aria-label"> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
}

export function SearchableMultiSelectField<T extends FieldValues>({
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
  selectedLabels,
}: SearchableMultiSelectFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue = Array.isArray(field.value)
          ? field.value.map(String)
          : field.value == null || field.value === ""
            ? []
            : [String(field.value)];

        const invalid = shouldShowFieldError(fieldState.error, formState.isSubmitted);

        return (
          <FormItem className={className}>
            {label && (
              <FormFieldLabel label={label} description={description} required={required} />
            )}
            <FormControl>
              <SearchableMultiSelect
                value={rawValue}
                onValueChange={field.onChange}
                placeholder={placeholder}
                searchPlaceholder={searchPlaceholder}
                disabled={disabled || submitting}
                queryKey={queryKey}
                fetchOptions={fetchOptions}
                selectedLabels={selectedLabels}
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
