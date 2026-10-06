import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchableSelectTriggerClassName } from "@/components/form/SearchableSelect";
import { cn } from "@/lib/utils";
import {
  MONTH_OPTIONS,
  buildWeeksForMonthYear,
  buildWeeksForYear,
  formatUkDateMonthText,
  formatWeekRangeMonthText,
  parseYmd,
  type CompleteWeekOption,
} from "@/lib/week-ending";

const ALL_MONTHS = "all";

export function WageWeekSelect({
  value,
  onValueChange,
  allValue,
  allLabel = "All weeks",
  weekendDays,
  weekEndingDay,
  disabled,
  className,
  triggerClassName,
  "aria-label": ariaLabel = "Week",
}: {
  value: string;
  onValueChange: (value: string) => void;
  allValue: string;
  allLabel?: string;
  weekendDays: number[];
  weekEndingDay: number;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  const today = useMemo(() => new Date(), []);
  const selectedYmd = value && value !== allValue ? value.slice(0, 10) : null;
  const selectedDate = selectedYmd ? parseYmd(selectedYmd) : null;

  const [year, setYear] = useState(
    () => selectedDate?.getFullYear() ?? today.getFullYear(),
  );
  const [month, setMonth] = useState<string>(
    () => (selectedDate ? String(selectedDate.getMonth() + 1) : String(today.getMonth() + 1)),
  );

  useEffect(() => {
    if (!open) return;
    if (selectedYmd) {
      const d = parseYmd(selectedYmd);
      setYear(d.getFullYear());
      setMonth(String(d.getMonth() + 1));
    }
    setSearch("");
  }, [open, selectedYmd]);

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

  const yearOptions = useMemo(() => {
    const current = today.getFullYear();
    const years = new Set<number>([current, current - 1, current - 2, current + 1]);
    if (selectedYmd) years.add(parseYmd(selectedYmd).getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [today, selectedYmd]);

  const weeks = useMemo(() => {
    if (month === ALL_MONTHS) {
      return buildWeeksForYear(year, weekendDays, weekEndingDay);
    }
    return buildWeeksForMonthYear(year, Number(month), weekendDays, weekEndingDay);
  }, [year, month, weekendDays, weekEndingDay]);

  const filteredWeeks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return weeks;
    return weeks.filter(
      (w) =>
        w.label.toLowerCase().includes(q) ||
        w.weekEnding.includes(q) ||
        w.weekStart.includes(q),
    );
  }, [weeks, search]);

  const displayLabel = useMemo(() => {
    if (value === allValue) return allLabel;
    if (!value) return "";
    const match = weeks.find((w) => w.weekEnding === value);
    if (match) return match.label;
    // Selected week may be outside current month filter — still show readable label.
    return formatUkDateMonthText(value);
  }, [value, allValue, allLabel, weeks]);

  function pick(next: string) {
    onValueChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              searchableSelectTriggerClassName,
              !displayLabel && "text-muted-foreground",
              triggerClassName,
            )}
          >
            <span className="truncate">{displayLabel || "Select week"}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          ref={contentRef}
          className="z-[60] w-[min(20rem,var(--radix-popover-trigger-width))] min-w-[18rem] p-0"
          align="start"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="grid grid-cols-2 gap-2 border-b px-3 py-2">
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Year
              </span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Filter weeks by year"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Month
              </span>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Filter weeks by month"
              >
                <option value={ALL_MONTHS}>All months</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="Search weeks…"
              className="w-full bg-transparent text-sm outline-none"
              autoFocus
              aria-label="Search weeks"
            />
          </div>

          <ul className="max-h-[22.5rem] list-none overflow-y-auto p-0">
            <WeekOptionRow
              label={allLabel}
              active={value === allValue}
              onClick={() => pick(allValue)}
            />
            {filteredWeeks.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No weeks found</li>
            ) : (
              filteredWeeks.map((week) => (
                <WeekOptionRow
                  key={week.weekEnding}
                  label={week.label}
                  active={value === week.weekEnding}
                  onClick={() => pick(week.weekEnding)}
                />
              ))
            )}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function WeekOptionRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent/10",
          active && "bg-accent/10 font-medium",
        )}
      >
        <span className="min-w-0 flex-1 whitespace-normal">{label}</span>
        {active ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
      </button>
    </li>
  );
}

/** Keep for callers that still need a standalone label helper. */
export function weekOptionLabel(week: Pick<CompleteWeekOption, "weekStart" | "weekEnding">) {
  return formatWeekRangeMonthText(week.weekStart, week.weekEnding);
}
