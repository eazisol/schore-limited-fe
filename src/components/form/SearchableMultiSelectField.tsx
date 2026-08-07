import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
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

        return (
          <FormItem className={className}>
            {label && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
              </FormLabel>
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
