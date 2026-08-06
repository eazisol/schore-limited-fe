import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebouncedSearch } from "@/components/data-table";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional lookup code (e.g. status HOLD). */
  code?: string;
}

export interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  /** React Query key prefix for this dropdown. */
  queryKey: readonly unknown[];
  /** Fetch options for the current search term (server-side). */
  fetchOptions: (search: string) => Promise<SearchableSelectOption[]>;
  /**
   * Label for the currently selected value when it may not be in the loaded page.
   */
  selectedLabel?: string | null;
  /**
   * Always-visible top option (e.g. "All customers" for list filters).
   * Use an empty string value for the clear/all state.
   */
  emptyOption?: SearchableSelectOption;
  /** Called when the user picks an option (value + label). */
  onSelect?: (option: SearchableSelectOption) => void;
  invalid?: boolean;
}

export function SearchableSelect({
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
  selectedLabel,
  emptyOption,
  onSelect,
  invalid,
}: SearchableSelectProps) {
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
    if (!emptyOption) return loaded;
    const withoutEmpty = loaded.filter((option) => option.value !== emptyOption.value);
    return [emptyOption, ...withoutEmpty];
  }, [optionsQuery.data, initialQuery.data, emptyOption]);

  const rawValue = value ?? "";
  const fromOptions = options.find((option) => option.value === rawValue)?.label;
  const displayLabel =
    (rawValue && fromOptions) ||
    (rawValue && selectedLabel?.trim()) ||
    (!rawValue && emptyOption?.label) ||
    "";

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
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between font-normal",
              !displayLabel && "text-muted-foreground",
              invalid && "border-destructive focus-visible:ring-destructive",
              triggerClassName,
            )}
          >
            <span className="truncate">{displayLabel || placeholder}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
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
                const active = option.value === rawValue;
                return (
                  <li key={option.value || "__empty__"}>
                    <button
                      type="button"
                      onClick={() => {
                        onValueChange(option.value);
                        onSelect?.(option);
                        setOpen(false);
                      }}
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
    </div>
  );
}
