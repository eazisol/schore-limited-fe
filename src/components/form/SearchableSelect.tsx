import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDebouncedSearch } from "@/components/data-table";

/** Matches `Input` / `SelectTrigger` styling for form dropdown triggers. */
export const searchableSelectTriggerClassName =
  "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-normal shadow-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional secondary line (e.g. role description). */
  description?: string;
  /** Optional lookup code (e.g. status HOLD). */
  code?: string;
  /** When set, options render under this section heading in the list. */
  group?: string;
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
  /** Lets RHF setFocus / DOM lookup target this control. */
  triggerRef?: Ref<HTMLButtonElement>;
  /** Attribute used by form invalid-focus helpers. */
  "data-field"?: string;
  /** React Query key prefix for this dropdown. */
  queryKey: readonly unknown[];
  /** Fetch options for the current search term (server-side). */
  fetchOptions: (search: string) => Promise<SearchableSelectOption[]>;
  /**
   * Label for the currently selected value when it may not be in the loaded page.
   */
  selectedLabel?: string | null;
  /**
   * Always-visible top option (e.g. "All clients" for list filters).
   * Use an empty string value for the clear/all state.
   */
  emptyOption?: SearchableSelectOption;
  /** Called when the user picks an option (value + label). */
  onSelect?: (option: SearchableSelectOption) => void;
  /** When set, shows an "Add" action at the bottom of the dropdown list. */
  onAddNew?: () => void;
  /** Label for the add action. Defaults to "Add new". */
  addNewLabel?: string;
  /** When true, shows a clear option while a value is selected. Defaults to false. */
  clearable?: boolean;
  /** Label for the clear option. Defaults to "Clear selection". */
  clearLabel?: string;
  invalid?: boolean;
  /** Replace the default text trigger (e.g. avatar button). Must forward a button. */
  renderTrigger?: (args: {
    open: boolean;
    disabled?: boolean;
  }) => ReactElement;
  /** Extra classes for the dropdown panel (e.g. fixed width with a custom trigger). */
  contentClassName?: string;
  /** Extra classes for the scrollable options list (default max-h-64). */
  listClassName?: string;
  /** Truncate option labels in the list (default true). Set false to show full names. */
  truncateOptions?: boolean;
  /** Popover alignment relative to the trigger. Defaults to "start". */
  contentAlign?: "start" | "center" | "end";
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
  triggerRef,
  "data-field": dataField,
  queryKey,
  fetchOptions,
  selectedLabel,
  emptyOption,
  onSelect,
  onAddNew,
  addNewLabel = "Add new",
  clearable = false,
  clearLabel = "Clear selection",
  invalid,
  renderTrigger,
  contentClassName,
  listClassName,
  truncateOptions = true,
  contentAlign = "start",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { searchInput, setSearchInput, search } = useDebouncedSearch({
    delayMs: 300,
  });

  const optionsQuery = useQuery({
    queryKey: [...queryKey, search],
    queryFn: () => fetchOptions(search),
    enabled: open || Boolean(search),
    staleTime: 30_000,
  });

  // Only fetch while closed when we need a label and the parent did not provide one.
  const needsLabelResolve = Boolean(value) && !selectedLabel?.trim();
  const initialQuery = useQuery({
    queryKey: [...queryKey, ""],
    queryFn: () => fetchOptions(""),
    enabled: needsLabelResolve,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) setSearchInput("");
  }, [open, setSearchInput]);

  // Close when clicking anywhere outside (works inside modals too).
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  const clearOption = useMemo<SearchableSelectOption>(
    () => ({ value: "", label: clearLabel }),
    [clearLabel],
  );

  const rawValue = value ?? "";

  const options = useMemo(() => {
    const loaded = optionsQuery.data ?? initialQuery.data ?? [];
    let list = loaded;

    if (emptyOption) {
      list = list.filter((option) => option.value !== emptyOption.value);
      list = [emptyOption, ...list];
    } else if (clearable && rawValue) {
      list = list.filter((option) => option.value !== "");
      list = [clearOption, ...list];
    }

    return list;
  }, [
    optionsQuery.data,
    initialQuery.data,
    emptyOption,
    clearable,
    rawValue,
    clearOption,
  ]);

  const fromOptions = options.find((option) => option.value === rawValue)?.label;
  const displayLabel =
    (rawValue && fromOptions) ||
    (rawValue && selectedLabel?.trim()) ||
    (!rawValue && emptyOption?.label) ||
    "";

  const groupedOptions = useMemo(() => {
    const hasGroups = options.some((option) => option.group?.trim());
    if (!hasGroups) {
      return [{ group: null as string | null, options }];
    }
    const order: string[] = [];
    const map = new Map<string, SearchableSelectOption[]>();
    const ungrouped: SearchableSelectOption[] = [];
    for (const option of options) {
      const group = option.group?.trim() || "";
      if (!group) {
        ungrouped.push(option);
        continue;
      }
      if (!map.has(group)) {
        order.push(group);
        map.set(group, []);
      }
      map.get(group)!.push(option);
    }
    const sections = order.map((group) => ({
      group,
      options: map.get(group) ?? [],
    }));
    if (ungrouped.length > 0) {
      sections.push({ group: null, options: ungrouped });
    }
    return sections;
  }, [options]);

  return (
    <div ref={rootRef} className={className}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          {renderTrigger ? (
            renderTrigger({ open, disabled })
          ) : (
            <button
              type="button"
              ref={triggerRef}
              data-field={dataField}
              role="combobox"
              aria-expanded={open}
              aria-label={ariaLabel}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              className={cn(
                searchableSelectTriggerClassName,
                !displayLabel && "text-muted-foreground",
                invalid && "border-destructive focus-visible:ring-destructive",
                triggerClassName,
              )}
            >
              <span className="truncate">{displayLabel || placeholder}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent
          ref={contentRef}
          className={cn(
            "z-[60] w-[var(--radix-popover-trigger-width)] p-0",
            contentClassName,
          )}
          align={contentAlign}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none"
              autoFocus
              aria-label={ariaLabel ? `Search ${ariaLabel}` : "Search"}
            />
            {optionsQuery.isFetching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <ul className={cn("max-h-64 list-none overflow-y-auto p-0", listClassName)}>
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {optionsQuery.isLoading || initialQuery.isLoading ? "Loading…" : "No results found"}
              </li>
            ) : (
              groupedOptions.map((section, sectionIndex) => (
                <li key={section.group ?? "__ungrouped__"} className="list-none">
                  {section.group ? (
                    <div
                      className={cn(
                        "sticky top-0 z-[1] bg-popover px-3",
                        sectionIndex === 0 ? "pt-0 pb-1" : "pt-1.5 pb-1",
                      )}
                    >
                      <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                        {section.group}
                      </span>
                    </div>
                  ) : null}
                  <ul className="m-0 list-none p-0">
                    {section.options.map((option) => {
                      const active = option.value === rawValue;
                      const isClearOption =
                        option.value === "" && (emptyOption?.value === "" || clearable);
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
                              "flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent/10",
                              active && "bg-accent/10 font-medium",
                              isClearOption && !active && "text-muted-foreground",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block",
                                  truncateOptions ? "truncate" : "whitespace-normal break-words",
                                )}
                              >
                                {option.label}
                              </span>
                              {option.description ? (
                                <span
                                  className={cn(
                                    "mt-0.5 block text-xs leading-snug text-muted-foreground",
                                    truncateOptions ? "truncate" : "whitespace-normal break-words",
                                  )}
                                >
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                            {active ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
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
    </div>
  );
}
