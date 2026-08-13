import { useMemo, useState } from "react";
import { ChevronDown, Info, Loader2 } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DashboardPeriod } from "@/lib/api/services/dashboard";
import { periodFallbackRange, toIsoDay } from "@/lib/dashboard-period";
import { cn } from "@/lib/utils";

const PRESETS: { id: Exclude<DashboardPeriod, "Custom">; label: string }[] = [
  { id: "Daily", label: "Daily" },
  { id: "Weekly", label: "Weekly" },
  { id: "Monthly", label: "Monthly" },
  { id: "Yearly", label: "Yearly" },
];

function parseIsoDay(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

function formatCompactDay(iso: string) {
  return parseIsoDay(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function formatRangeButtonLabel(from: string, to: string) {
  const fromDay = from.slice(0, 10);
  const toDay = to.slice(0, 10);
  if (fromDay === toDay) return formatCompactDay(fromDay);

  const fromDate = parseIsoDay(fromDay);
  const toDate = parseIsoDay(toDay);
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  if (sameYear) return `${formatCompactDay(fromDay)} – ${formatCompactDay(toDay)}`;

  const withYear = (iso: string) =>
    parseIsoDay(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  return `${withYear(fromDay)} – ${withYear(toDay)}`;
}

export function DashboardPeriodFilter({
  period,
  onPeriodChange,
  customFrom,
  customTo,
  onCustomChange,
  fetching = false,
}: {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
  fetching?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();

  const displayRange = useMemo(
    () =>
      period === "Custom"
        ? { from: customFrom, to: customTo }
        : periodFallbackRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const openCalendar = () => {
    setDraft({
      from: parseIsoDay(displayRange.from),
      to: parseIsoDay(displayRange.to),
    });
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      openCalendar();
      return;
    }
    setOpen(false);
  };

  const handlePreset = (next: Exclude<DashboardPeriod, "Custom">) => {
    setOpen(false);
    onPeriodChange(next);
  };

  const applyDraft = () => {
    if (!draft?.from || !draft?.to) return;
    const from = toIsoDay(draft.from);
    const to = toIsoDay(draft.to);
    const [start, end] = from <= to ? [from, to] : [to, from];
    onCustomChange(start, end);
    onPeriodChange("Custom");
    setOpen(false);
  };

  const canApply = Boolean(draft?.from && draft?.to);

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm font-medium shadow-sm transition-colors",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              (open || period === "Custom") && "bg-muted/60",
            )}
            aria-label="Choose date range"
          >
            <span className="tabular-nums">{formatRangeButtonLabel(displayRange.from, displayRange.to)}</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0" sideOffset={8}>
          <Calendar
            key={open ? displayRange.from : "closed"}
            mode="range"
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from}
            numberOfMonths={1}
            disabled={{ after: new Date() }}
            weekStartsOn={1}
            className="p-3"
          />
          <div className="flex items-center justify-end gap-2 border-t px-3 py-2.5">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={!canApply} onClick={applyDraft}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <AppTooltip content="Pick Daily, Weekly, Monthly, or Yearly — or choose a custom range from the date field.">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
          <Info className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Period filter help</span>
        </span>
      </AppTooltip>

      <div className="flex items-center gap-0.5" role="tablist" aria-label="Dashboard period">
        {PRESETS.map((preset) => {
          const selected = period === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => handlePreset(preset.id)}
              className={cn(
                "h-8 rounded-full px-3 text-sm font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
        {fetching ? (
          <Loader2 className="ml-1 h-4 w-4 animate-spin text-muted-foreground" aria-label="Updating" />
        ) : null}
      </div>
    </div>
  );
}
