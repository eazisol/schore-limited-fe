import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ComponentProps, type HTMLAttributes } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { DayButton } from "react-day-picker";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/Modal";
import { Form, TextField, TextareaField, SwitchField, SubmitButton } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { AppTooltip } from "@/components/AppTooltip";
import { holidaysService, type ApiHoliday, type HolidayPayload } from "@/lib/api/services/holidays";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { activeStatusClass } from "@/lib/module-ui";
import { HOLIDAYS_LABEL, HOLIDAYS_ROUTE } from "@/lib/holidays";
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  descriptionSchema,
  nameSchema,
} from "@/lib/field-validation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/holidays")({
  head: () => ({ meta: [{ title: `${HOLIDAYS_LABEL} | Schore` }] }),
  component: HolidaysPage,
});

export const holidaysQueryKey = ["holidays"] as const;

const schema = z.object({
  name: nameSchema(),
  date: z.string().min(1, "Date is required"),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create"; date?: string }
  | { kind: "edit"; item: ApiHoliday }
  | { kind: "view"; item: ApiHoliday };

/** JS getDay(): 0 = Sunday … 6 = Saturday */
const WEEKDAY_OPTIONS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
] as const;

const DEFAULT_OFF_WEEKDAYS = new Set<number>([0, 6]);

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: new Date(2000, index, 1).toLocaleDateString("en-GB", { month: "long" }),
}));

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function holidayDateKey(item: ApiHoliday): string {
  return item.date?.slice(0, 10) ?? "";
}

function monthBounds(month: Date): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: toYmd(new Date(month.getFullYear(), month.getMonth(), 1)),
    dateTo: toYmd(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  };
}

function buildYearOptions(centerYear: number): number[] {
  const years: number[] = [];
  for (let y = centerYear - 10; y <= centerYear + 15; y++) years.push(y);
  return years;
}

function HolidaysPage() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: HOLIDAYS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: HOLIDAYS_ROUTE, action: "delete" });

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [offWeekdays, setOffWeekdays] = useState<Set<number>>(() => new Set(DEFAULT_OFF_WEEKDAYS));
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiHoliday | null>(null);

  const { dateFrom, dateTo } = useMemo(() => monthBounds(month), [month]);

  const query = useQuery({
    queryKey: [...holidaysQueryKey, { dateFrom, dateTo }],
    queryFn: async () =>
      (
        await holidaysService.list({
          page: 1,
          pageSize: 100,
          dateFrom,
          dateTo,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, ApiHoliday[]>();
    for (const item of rows) {
      const key = holidayDateKey(item);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [rows]);

  const holidayDates = useMemo(
    () => [...holidaysByDate.keys()].map((ymd) => parseYmd(ymd)),
    [holidaysByDate],
  );

  const offDayDates = useMemo(() => {
    const days: Date[] = [];
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= end; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      if (offWeekdays.has(date.getDay())) days.push(date);
    }
    return days;
  }, [month, offWeekdays]);

  const selectedDate = selectedYmd ? parseYmd(selectedYmd) : undefined;
  const selectedHolidays = selectedYmd ? (holidaysByDate.get(selectedYmd) ?? []) : [];
  const monthHolidayCount = rows.length;
  const checkedCount = offWeekdays.size;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => holidaysService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Holiday deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: holidaysQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete holiday"),
  });

  function toggleOffWeekday(day: number, checked: boolean) {
    setOffWeekdays((prev) => {
      const next = new Set(prev);
      if (checked) next.add(day);
      else next.delete(day);
      return next;
    });
  }

  function handleDaySelect(day: Date | undefined) {
    if (!day) {
      setSelectedYmd(null);
      return;
    }
    const ymd = toYmd(day);
    setSelectedYmd(ymd);
    setMonth(new Date(day.getFullYear(), day.getMonth(), 1));

    const existing = holidaysByDate.get(ymd) ?? [];
    if (existing.length === 0) {
      if (canModify) setMode({ kind: "create", date: ymd });
      return;
    }
    if (existing.length === 1) {
      setMode({ kind: "view", item: existing[0] });
    }
  }

  function goToMonth(next: Date) {
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setSelectedYmd(null);
  }

  function shiftMonth(delta: number) {
    goToMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  function goToToday() {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedYmd(toYmd(today));
  }

  const yearOptions = useMemo(() => buildYearOptions(new Date().getFullYear()), []);
  const minNavMonth = useMemo(() => new Date(yearOptions[0], 0, 1), [yearOptions]);
  const maxNavMonth = useMemo(
    () => new Date(yearOptions[yearOptions.length - 1], 11, 1),
    [yearOptions],
  );
  const canGoPrev =
    month.getFullYear() > minNavMonth.getFullYear() ||
    (month.getFullYear() === minNavMonth.getFullYear() &&
      month.getMonth() > minNavMonth.getMonth());
  const canGoNext =
    month.getFullYear() < maxNavMonth.getFullYear() ||
    (month.getFullYear() === maxNavMonth.getFullYear() &&
      month.getMonth() < maxNavMonth.getMonth());

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthTitle = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-0 flex-col gap-3 overflow-hidden">
      <PageHeader
        title={HOLIDAYS_LABEL}
        subtitle="Excluded automatically from DAYS and KPI working-day counts."
        actions={
          <Can route={HOLIDAYS_ROUTE} action="modify">
            <Button
              size="sm"
              onClick={() => setMode({ kind: "create", date: selectedYmd ?? toYmd(new Date()) })}
            >
              <Plus className="h-4 w-4" />
              Add holiday
            </Button>
          </Can>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-12 lg:gap-4">
        {/* Working days — 4/12 */}
        <section className="order-2 flex min-h-0 lg:order-1 lg:col-span-4">
          <div className="card-elevated flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border bg-card">
            <div className="shrink-0 border-b px-4 py-2.5">
              <h2 className="font-display text-base font-semibold tracking-tight">This month</h2>
              <p className="text-xs text-muted-foreground">
                Working days · {checkedCount} off day{checkedCount === 1 ? "" : "s"} checked
              </p>
            </div>

            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              {WEEKDAY_OPTIONS.map((opt) => {
                const checked = offWeekdays.has(opt.day);
                const id = `weekday-off-${opt.day}`;
                return (
                  <li key={opt.day}>
                    <label
                      htmlFor={id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-1.5 transition-colors",
                        checked
                          ? "border-accent/30 bg-secondary/50"
                          : "border-transparent hover:bg-muted/50",
                        !canModify && "cursor-default",
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={!canModify}
                        onCheckedChange={(value) => toggleOffWeekday(opt.day, value === true)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-tight">{opt.label}</span>
                        <span className="block text-[11px] leading-tight text-muted-foreground">
                          {checked ? "Off day (non-working)" : "Working day"}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="shrink-0 border-t px-4 py-2.5 text-xs text-muted-foreground">
              {monthTitle}: {daysInMonth} days · {monthHolidayCount} holiday
              {monthHolidayCount === 1 ? "" : "s"}
            </div>
          </div>
        </section>

        {/* Calendar — 8/12 */}
        <section className="order-1 flex min-h-0 lg:order-2 lg:col-span-8">
          <div className="card-elevated flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border bg-card">
            <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold tracking-tight">
                  Calendar · {monthTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedYmd
                    ? selectedHolidays.length > 0
                      ? `${selectedHolidays.length} holiday${selectedHolidays.length === 1 ? "" : "s"} on ${parseYmd(selectedYmd).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`
                      : `Selected ${parseYmd(selectedYmd).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`
                    : `${daysInMonth} days in ${month.toLocaleDateString("en-GB", { month: "long" })} · click a box to add or open a holiday`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Previous month"
                  disabled={!canGoPrev}
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={String(month.getMonth())}
                  onValueChange={(value) =>
                    goToMonth(new Date(month.getFullYear(), Number(value), 1))
                  }
                >
                  <SelectTrigger className="h-9 w-[8.5rem] bg-card" aria-label="Select month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(month.getFullYear())}
                  onValueChange={(value) => goToMonth(new Date(Number(value), month.getMonth(), 1))}
                >
                  <SelectTrigger className="h-9 w-[5.5rem] bg-card" aria-label="Select year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Next month"
                  disabled={!canGoNext}
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={goToToday}
                >
                  Today
                </Button>
                {query.isFetching && !query.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
              {query.isLoading ? (
                <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading calendar…
                </div>
              ) : query.isError ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
                  <p className="font-medium">Unable to load holidays</p>
                  <p className="text-sm text-muted-foreground">
                    {(query.error as unknown as ApiError)?.message || "Please try again."}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <Calendar
                  mode="single"
                  month={month}
                  onMonthChange={goToMonth}
                  selected={selectedDate}
                  onSelect={handleDaySelect}
                  hideNavigation
                  showOutsideDays
                  fixedWeeks
                  weekStartsOn={1}
                  startMonth={minNavMonth}
                  endMonth={maxNavMonth}
                  modifiers={{
                    hasHoliday: holidayDates,
                    offDay: offDayDates,
                  }}
                  className="flex h-full min-h-0 w-full max-w-none flex-col bg-transparent p-0"
                  classNames={{
                    root: "flex h-full min-h-0 w-full max-w-none flex-col",
                    months: "flex h-full min-h-0 w-full flex-col",
                    month: "flex h-full min-h-0 w-full flex-col gap-2",
                    month_caption: "hidden",
                    caption_label: "hidden",
                    nav: "hidden",
                    month_grid: "flex h-full min-h-0 w-full flex-col gap-1.5",
                    weekdays: "grid shrink-0 grid-cols-7 gap-1.5",
                    weekday:
                      "flex h-8 items-center justify-center rounded-md bg-muted/50 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    weeks: "grid min-h-0 flex-1 grid-rows-6 gap-1.5",
                    week: "grid min-h-0 grid-cols-7 gap-1.5",
                    day: "min-h-0 min-w-0 bg-transparent",
                    // Do not fill the cell — HolidayDayCell owns today/holiday/selected chrome.
                    today: "bg-transparent text-foreground rounded-lg",
                    day_button: "!aspect-auto !h-full !min-h-0 !min-w-0 !w-full rounded-lg p-0",
                    outside: "opacity-55",
                  }}
                  components={{
                    MonthGrid: ({ className, ...props }) => (
                      <div
                        className={cn("flex h-full min-h-0 w-full flex-col gap-1.5", className)}
                        {...props}
                      />
                    ),
                    Weekdays: ({ className, ...props }) => (
                      <div
                        role="row"
                        className={cn("grid shrink-0 grid-cols-7 gap-1.5", className)}
                        {...props}
                      />
                    ),
                    Weekday: ({ className, ...props }) => (
                      <div
                        role="columnheader"
                        className={cn(
                          "flex h-8 items-center justify-center rounded-md bg-muted/50 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    Weeks: ({ className, ...props }) => (
                      <div
                        className={cn("grid min-h-0 flex-1 grid-rows-6 gap-1.5", className)}
                        {...props}
                      />
                    ),
                    Week: ({
                      className,
                      week: _week,
                      ...props
                    }: HTMLAttributes<HTMLDivElement> & { week?: unknown }) => (
                      <div
                        role="row"
                        className={cn("grid min-h-0 grid-cols-7 gap-1.5", className)}
                        {...props}
                      />
                    ),
                    Day: ({
                      className,
                      day: _day,
                      modifiers: _modifiers,
                      ...props
                    }: HTMLAttributes<HTMLDivElement> & { day?: unknown; modifiers?: unknown }) => (
                      <div
                        role="gridcell"
                        className={cn(className, "min-h-0 min-w-0 bg-transparent")}
                        {...props}
                      />
                    ),
                    DayButton: (props) => (
                      <HolidayDayCell
                        {...props}
                        holidays={holidaysByDate.get(toYmd(props.day.date)) ?? []}
                        isOffDay={offWeekdays.has(props.day.date.getDay())}
                      />
                    ),
                  }}
                />
              )}

              {selectedYmd && selectedHolidays.length > 0 ? (
                <div className="mt-3 grid max-h-28 shrink-0 gap-2 overflow-y-auto border-t pt-3 sm:grid-cols-2">
                  {selectedHolidays.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="rounded-lg border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                      onClick={() => setMode({ kind: "view", item })}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                            activeStatusClass(item.isActive),
                          )}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {mode && (
        <HolidayFormModal
          key={
            mode.kind === "create" ? `create-${mode.date ?? "new"}` : `${mode.kind}-${mode.item.id}`
          }
          mode={mode}
          canModify={canModify}
          canDelete={canDelete}
          onClose={() => {
            setMode(null);
            setSelectedYmd(null);
          }}
          onEdit={(item) => setMode({ kind: "edit", item })}
          onDelete={(item) => {
            setMode(null);
            setSelectedYmd(null);
            setConfirmDel(item);
          }}
          onSaved={() => {
            setMode(null);
            setSelectedYmd(null);
            qc.invalidateQueries({ queryKey: holidaysQueryKey });
          }}
        />
      )}

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmDel(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">
              Delete holiday “{confirmDel.name}”?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDel(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDel.id)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HolidayDayCell({
  className,
  day,
  modifiers,
  holidays,
  isOffDay,
  ...props
}: ComponentProps<typeof DayButton> & {
  holidays: ApiHoliday[];
  isOffDay: boolean;
}) {
  const hasHoliday = holidays.length > 0;
  const isSelected = Boolean(modifiers.selected);
  const isToday = Boolean(modifiers.today);
  const isOutside = Boolean(modifiers.outside);

  return (
    <button
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected={isSelected || undefined}
      className={cn(
        // Incoming Calendar/DayPicker classes first so cell chrome below wins (twMerge).
        className,
        "flex h-full min-h-0 w-full flex-col items-stretch gap-1 overflow-hidden rounded-lg border p-1.5 text-left text-foreground transition-colors sm:p-2",
        isOutside && "bg-muted/20 text-muted-foreground",
        !isOutside && !hasHoliday && !isOffDay && "bg-background hover:bg-muted/40",
        isOffDay && !hasHoliday && "border-border bg-muted/45",
        hasHoliday && "border-accent/35 bg-accent/5 hover:bg-accent/10",
        isToday && !isSelected && "ring-1 ring-accent/50",
        isSelected && "border-accent bg-background ring-2 ring-accent/40",
      )}
      {...props}
    >
      <span
        className={cn(
          "text-sm font-semibold leading-none sm:text-base",
          isOutside ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {day.date.getDate()}
      </span>

      {hasHoliday ? (
        <span className="mt-auto flex min-h-0 flex-1 flex-col justify-end gap-0.5 overflow-hidden">
          {holidays.slice(0, 2).map((item) => (
            <AppTooltip key={item.id} content={item.name} asChild align="start">
              <span className="line-clamp-1 cursor-default rounded bg-accent/15 px-1 py-0.5 text-[10px] font-medium leading-tight text-accent">
                {item.name}
              </span>
            </AppTooltip>
          ))}
          {holidays.length > 2 ? (
            <AppTooltip
              content={holidays
                .slice(2)
                .map((item) => item.name)
                .join(", ")}
              asChild
              align="start"
            >
              <span className="cursor-default text-[10px] font-medium text-muted-foreground">
                +{holidays.length - 2} more
              </span>
            </AppTooltip>
          ) : null}
        </span>
      ) : isOffDay && !isOutside ? (
        <span className="mt-auto text-[10px] font-medium text-muted-foreground">Off day</span>
      ) : null}
    </button>
  );
}

function HolidayFormModal({
  mode,
  onClose,
  onSaved,
  onEdit,
  onDelete,
  canModify,
  canDelete,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
  onEdit: (item: ApiHoliday) => void;
  onDelete: (item: ApiHoliday) => void;
  canModify: boolean;
  canDelete: boolean;
}) {
  const isView = mode.kind === "view";
  const existing = mode.kind === "create" ? null : mode.item;
  const createDate = mode.kind === "create" ? mode.date : undefined;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      name: existing?.name ?? "",
      date: existing?.date?.slice(0, 10) ?? createDate ?? "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: HolidayPayload) => {
      if (mode.kind === "edit") return holidaysService.update(mode.item.id, payload);
      return holidaysService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message || (mode.kind === "edit" ? "Holiday updated" : "Holiday created"));
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save holiday"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      date: values.date,
      description: values.description.trim() || null,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create" ? "Add holiday" : mode.kind === "edit" ? "Edit holiday" : "View holiday";

  return (
    <Form form={form} onSubmit={submit} className="contents">
      <Modal
        open
        onClose={onClose}
        title={title}
        size="md"
        showCloseButton={false}
        headerActions={<SwitchField<Values> name="isActive" label="Active" disabled={isView} />}
      >
        <div className="space-y-4">
          <fieldset disabled={isView} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField<Values>
                name="name"
                label="Name"
                required
                autoFocus={!isView}
                maxLength={NAME_MAX_LENGTH}
              />
              <TextField<Values> name="date" label="Date" type="date" required />
            </div>
            <TextareaField<Values>
              name="description"
              label="Description"
              rows={3}
              maxLength={DESCRIPTION_MAX_LENGTH}
            />
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-2">
            {isView ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
                {canModify && existing ? (
                  <Button type="button" size="sm" onClick={() => onEdit(existing)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
                {canDelete && existing ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(existing)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <SubmitButton size="sm" loadingText="Saving…">
                  {mode.kind === "edit" ? "Update holiday" : "Create holiday"}
                </SubmitButton>
              </>
            )}
          </div>
        </div>
      </Modal>
    </Form>
  );
}
