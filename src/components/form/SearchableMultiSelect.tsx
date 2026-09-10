import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDebouncedSearch } from "@/components/data-table";
import type { SearchableSelectOption } from "./SearchableSelect";
import { searchableSelectTriggerClassName } from "./SearchableSelect";
import { RoleCodeBadge } from "@/components/RoleCodeBadge";
import { parseAssignableStaffLabel } from "@/lib/project-assignee";

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
  onAddNew?: () => void;
  addNewLabel?: string;
}

function resolveOptionDisplay(
  optionValue: string,
  options: SearchableSelectOption[],
  selectedLabels?: Record<string, string>,
): { label: string; code?: string } {
  const fromOptions = options.find((option) => option.value === optionValue);
  if (fromOptions) {
    return {
      label: fromOptions.label,
      code: fromOptions.code,
    };
  }
  const raw = selectedLabels?.[optionValue] || optionValue;
  const parsed = parseAssignableStaffLabel(raw);
  return { label: parsed.label || raw, code: parsed.code };
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
  onAddNew,
  addNewLabel = "Add new",
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

  const needsLabelResolve = selected.some(
    (id) => !selectedLabels?.[id]?.trim(),
  );
  const initialQuery = useQuery({
    queryKey: [...queryKey, ""],
    queryFn: () => fetchOptions(""),
    enabled: needsLabelResolve,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) setSearchInput("");
  }, [open, setSearchInput]);

  const options = optionsQuery.data ?? initialQuery.data ?? [];

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

  const triggerLabel =
    selected.length === 1
      ? resolveOptionDisplay(selected[0], options, selectedLabels)
      : null;

  return (
    <div className={cn("min-w-0 w-full max-w-full", className)}>
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
              "min-h-9 h-auto min-w-0 w-full",
              selected.length === 0 && "text-muted-foreground",
              invalid && "border-destructive focus-visible:ring-destructive",
              triggerClassName,
            )}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {selected.length === 0 ? (
                placeholder
              ) : selected.length === 1 ? (
                <span className="inline-flex max-w-full items-center gap-1.5">
                  <span className="min-w-0 truncate">{triggerLabel?.label}</span>
                  <RoleCodeBadge code={triggerLabel?.code} />
                </span>
              ) : (
                `${selected.length} selected`
              )}
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
                const display = option.code
                  ? { label: option.label, code: option.code }
                  : parseAssignableStaffLabel(option.label);
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
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="min-w-0 truncate">{display.label || option.label}</span>
                        <RoleCodeBadge code={option.code ?? display.code} />
                      </span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {onAddNew ? (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  onAddNew();
                }}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-accent transition-colors hover:bg-accent/10"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">{addNewLabel}</span>
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="mt-2 flex max-w-full flex-wrap gap-1.5 overflow-hidden">
          {selected.map((optionValue) => {
            const display = resolveOptionDisplay(optionValue, options, selectedLabels);
            return (
              <span
                key={optionValue}
                className="inline-flex max-w-full items-center gap-1 rounded-md border bg-secondary px-2 py-0.5 text-xs"
              >
                <span className="min-w-0 truncate">{display.label}</span>
                <RoleCodeBadge code={display.code} />
                {!disabled ? (
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 hover:bg-background"
                    aria-label={`Remove ${display.label}`}
                    onClick={() => remove(optionValue)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
