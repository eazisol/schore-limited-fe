import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebouncedSearch } from "@/components/data-table";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
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
  queryKey,
  fetchOptions,
  selectedLabel,
  onSelect,
}: SearchableSelectFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  const [open, setOpen] = useState(false);
  const { searchInput, setSearchInput, search } = useDebouncedSearch({
    delayMs: 300,
  });

  const optionsQuery = useQuery({
    queryKey: [...queryKey, search],
    queryFn: () => fetchOptions(search),
    enabled: open || Boolean(search),
    staleTime: 30_000,
  });

  // Warm the first page so the trigger can resolve labels without opening.
  const initialQuery = useQuery({
    queryKey: [...queryKey, ""],
    queryFn: () => fetchOptions(""),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) setSearchInput("");
  }, [open, setSearchInput]);

  const options = useMemo(() => {
    const loaded = optionsQuery.data ?? initialQuery.data ?? [];
    return loaded;
  }, [optionsQuery.data, initialQuery.data]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue = field.value == null ? "" : String(field.value);
        const fromOptions = options.find((o) => o.value === rawValue)?.label;
        const displayLabel =
          (rawValue && fromOptions) ||
          (rawValue && selectedLabel?.trim()) ||
          "";

        return (
          <FormItem className={className}>
            {label && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
              </FormLabel>
            )}
            <Popover
              open={open}
              onOpenChange={(next) => {
                if (disabled || submitting) return;
                setOpen(next);
              }}
            >
              <FormControl>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-required={required}
                    aria-invalid={!!fieldState.error}
                    disabled={disabled || submitting}
                    className={cn(
                      "h-10 w-full justify-between font-normal",
                      !displayLabel && "text-muted-foreground",
                      fieldState.error && "border-destructive focus-visible:ring-destructive",
                    )}
                  >
                    <span className="truncate">{displayLabel || placeholder}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
              </FormControl>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full bg-transparent text-sm outline-none"
                    autoFocus
                    aria-label={typeof label === "string" ? `Search ${label}` : "Search"}
                  />
                  {optionsQuery.isFetching ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                <ul className="max-h-64 overflow-y-auto py-1">
                  {options.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      {optionsQuery.isLoading || initialQuery.isLoading
                        ? "Loading…"
                        : "No results found"}
                    </li>
                  ) : (
                    options.map((option) => {
                      const active = option.value === rawValue;
                      return (
                        <li key={option.value}>
                          <button
                            type="button"
                            onClick={() => {
                              field.onChange(option.value);
                              onSelect?.(option);
                              setOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10",
                              active && "bg-accent/10 font-medium",
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate">{option.label}</span>
                            {active ? (
                              <Check className="h-4 w-4 shrink-0 text-accent" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </PopoverContent>
            </Popover>
            {description && <FormDescription>{description}</FormDescription>}
          </FormItem>
        );
      }}
    />
  );
}
