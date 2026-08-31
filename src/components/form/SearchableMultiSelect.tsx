import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDebouncedSearch } from "@/components/data-table";
import type { SearchableSelectOption } from "./SearchableSelect";
import { searchableSelectTriggerClassName } from "./SearchableSelect";

export interface SearchableMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  queryKey: readonly unknown[];
  fetchOptions: (search: string) => Promise<SearchableSelectOption[]>;
  /** Labels for selected values that may not be in the current options page. */
  selectedLabels?: Record<string, string>;
  invalid?: boolean;
}

export function SearchableMultiSelect({
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  queryKey,
  fetchOptions,
  selectedLabels,
  invalid,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const { searchInput, setSearchInput, search } = useDebouncedSearch({
    delayMs: 300,
  });

  const selected = useMemo(
    () => (value ?? []).map(String).filter(Boolean),
    [value],
  );

  const optionsQuery = useQuery({
    queryKey: [...queryKey, search],
    queryFn: () => fetchOptions(search),
    enabled: open || Boolean(search),
    staleTime: 30_000,
  });

  const initialQuery = useQuery({
    queryKey: [...queryKey, ""],
    queryFn: () => fetchOptions(""),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) setSearchInput("");
  }, [open, setSearchInput]);

  const options = optionsQuery.data ?? initialQuery.data ?? [];

  function resolveLabel(optionValue: string): string {
    return (
      options.find((option) => option.value === optionValue)?.label ||
      selectedLabels?.[optionValue] ||
      optionValue
    );
  }

  function toggle(optionValue: string) {
    if (selected.includes(optionValue)) {
      onValueChange(selected.filter((item) => item !== optionValue));
      return;
    }
    onValueChange([...selected, optionValue]);
  }

  function remove(optionValue: string) {
    onValueChange(selected.filter((item) => item !== optionValue));
  }

  return (
    <div className={className}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              searchableSelectTriggerClassName,
              "min-h-9 h-auto",
              selected.length === 0 && "text-muted-foreground",
              invalid && "border-destructive focus-visible:ring-destructive",
              triggerClassName,
            )}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {selected.length === 0
                ? placeholder
                : selected.map(resolveLabel).join(", ")}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none"
              autoFocus
              aria-label={ariaLabel ? `Search ${ariaLabel}` : "Search"}
            />
            {optionsQuery.isFetching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {optionsQuery.isLoading || initialQuery.isLoading ? "Loading…" : "No results found"}
              </li>
            ) : (
              options.map((option) => {
                const active = selected.includes(option.value);
                return (
                  <li key={option.value || "__empty__"}>
                    <button
                      type="button"
                      onClick={() => toggle(option.value)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10",
                        active && "bg-accent/10 font-medium",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((optionValue) => (
            <span
              key={optionValue}
              className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-0.5 text-xs"
            >
              {resolveLabel(optionValue)}
              {!disabled ? (
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-background"
                  aria-label={`Remove ${resolveLabel(optionValue)}`}
                  onClick={() => remove(optionValue)}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
