import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type HTMLAttributes,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { DayButton } from "react-day-picker";
import { AppTooltip } from "@/components/AppTooltip";
import { Modal } from "@/components/Modal";
import { JobDayItemsEditor } from "@/components/tasks/JobDayItemsEditor";
import { usePermission } from "@/components/Permission";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { holidaysService } from "@/lib/api/services/holidays";
import {
  dailyProgrammeService,
  type ApiDailyRow,
} from "@/lib/api/services/daily-programme";
import type { ApiTask, ApiTaskItem } from "@/lib/api/services/tasks";
import type { ApiError } from "@/lib/api/axios";
import { DAILY_ROUTE } from "@/lib/daily";
import { TASKS_ROUTE } from "@/lib/tasks";
import { fmtGBP } from "@/lib/data";
import { holidaysQueryKey, weekendQueryKey } from "@/routes/holidays";
import { toYmd, parseYmd } from "@/lib/week-ending";
import {
  isOffDayDate,
  OFF_DAY_ASSIGN_MESSAGE,
} from "@/lib/working-days";
import { cn } from "@/lib/utils";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: new Date(2000, index, 1).toLocaleDateString("en-GB", { month: "long" }),
}));

function buildYearOptions(centerYear: number): number[] {
  const years: number[] = [];
  for (let y = centerYear - 10; y <= centerYear + 15; y++) years.push(y);
  return years;
}

/** Minimal Daily Programme row so we can assign on days the job is not yet on the board. */
function stubDailyRowFromTask(task: ApiTask, isLocked = false): ApiDailyRow {
  return {
    no: 0,
    taskId: String(task.id),
    taskNumber: task.taskNumber,
    propertyId: task.propertyId,
    propertyName: task.propertyName,
    propertyAddress: task.propertyAddress,
    accessNotes: null,
    contract: task.contract,
    postCode: task.postCode,
    type: task.jobTypeName,
    startingDate: task.startDate,
    handOverDate: task.handOverDate,
    daysCount: task.daysCount,
    heldDaysCount: task.heldDaysCount,
    statusCode: task.statusCode,
    statusName: task.statusName,
    tradeOrStatus: task.statusName,
    previousDayName: null,
    previousDayTrades: null,
    previousDayDetails: null,
    nameDisplay: null,
    notesDisplay: null,
    timeDisplay: null,
    isLocked: isLocked || Boolean(task.isLocked),
    allocations: [],
    assignedPackages: [],
    unassignedPackages: [],
    assignedAddOns: [],
    unassignedAddOns: [],
    assignedByOperative: [],
    nameOperatives: [],
    nextDay: null,
    nextDayTrades: null,
    nextDayDetails: null,
  };
}

function itemLabel(item: ApiTaskItem): string {
  return (
    item.tradeGroupName?.trim() ||
    item.productName?.trim() ||
    item.operativeName?.trim() ||
    "Item"
  );
}

type JobWorkCalendarProps = {
  task: ApiTask;
};

/** Full-width job schedule. Day click opens Daily-style assign / complete / remove modal. */
export function JobWorkCalendar({ task }: JobWorkCalendarProps) {
  const canModifyDaily = usePermission({ route: DAILY_ROUTE, action: "modify" });
  const canModifyTasks = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const canEditDay = canModifyDaily || canModifyTasks;

  const items = task.items ?? [];

  const firstWorkYmd = useMemo(() => {
    const dates = items
      .map((item) => item.workDate?.slice(0, 10))
      .filter((value): value is string => Boolean(value))
      .sort();
    return dates[0] ?? task.startDate?.slice(0, 10) ?? null;
  }, [items, task.startDate]);

  const [month, setMonth] = useState(() => {
    const seed = firstWorkYmd ? parseYmd(firstWorkYmd) : new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [liveRow, setLiveRow] = useState<ApiDailyRow | null>(null);

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

  const monthTitle = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const monthStart = toYmd(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = toYmd(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  const weekendQuery = useQuery({
    queryKey: weekendQueryKey,
    queryFn: async () => (await holidaysService.getWeekend()).data,
  });

  const holidaysQuery = useQuery({
    queryKey: [...holidaysQueryKey, { dateFrom: monthStart, dateTo: monthEnd }],
    queryFn: async () =>
      (
        await holidaysService.list({
          dateFrom: monthStart,
          dateTo: monthEnd,
          page: 1,
          pageSize: 100,
        })
      ).data,
  });

  const offWeekdays = useMemo(() => {
    if (!weekendQuery.data?.days) return undefined;
    return new Set(weekendQuery.data.days);
  }, [weekendQuery.data?.days]);

  const holidayYmds = useMemo(() => {
    const set = new Set<string>();
    for (const h of holidaysQuery.data?.items ?? []) {
      if (!h.isActive) continue;
      const ymd = h.date?.slice(0, 10);
      if (ymd) set.add(ymd);
    }
    return set;
  }, [holidaysQuery.data?.items]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ApiTaskItem[]>();
    for (const item of items) {
      const key = item.workDate?.slice(0, 10);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [items]);

  const monthDayKeys = useMemo(
    () =>
      Array.from(itemsByDate.keys())
        .filter((ymd) => ymd >= monthStart && ymd <= monthEnd)
        .sort((a, b) => a.localeCompare(b)),
    [itemsByDate, monthStart, monthEnd],
  );

  const workDates = useMemo(
    () => monthDayKeys.map((ymd) => parseYmd(ymd)),
    [monthDayKeys],
  );

  const offDayDates = useMemo(() => {
    const dates: Date[] = [];
    const cursor = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    while (cursor <= last) {
      if (isOffDayDate(cursor, offWeekdays, holidayYmds)) dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [month, offWeekdays, holidayYmds]);

  const dayProgrammeQuery = useQuery({
    queryKey: ["daily-programme", "job-calendar-day", selectedYmd, task.id],
    queryFn: async () => {
      const withProperty = (
        await dailyProgrammeService.get({
          date: selectedYmd!,
          includeAllStatuses: true,
          propertyId: task.propertyId,
        })
      ).data;
      const match = withProperty.rows?.find((row) => String(row.taskId) === String(task.id));
      if (match) return withProperty;
      return (
        await dailyProgrammeService.get({
          date: selectedYmd!,
          includeAllStatuses: true,
        })
      ).data;
    },
    enabled: dayModalOpen && Boolean(selectedYmd),
  });

  useEffect(() => {
    if (!dayModalOpen) {
      setLiveRow(null);
      return;
    }
    const rows = dayProgrammeQuery.data?.rows ?? [];
    const match = rows.find((row) => String(row.taskId) === String(task.id)) ?? null;
    setLiveRow(match);
  }, [dayModalOpen, dayProgrammeQuery.data, task.id]);

  const selectedDate = selectedYmd ? parseYmd(selectedYmd) : undefined;
  const selectedItems = selectedYmd ? (itemsByDate.get(selectedYmd) ?? []) : [];

  const assignedCount = selectedItems.length;
  const assignedTotal = selectedItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );

  const modalTitle = selectedYmd
    ? parseYmd(selectedYmd).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Work day";

  const modalSubtitle =
    assignedCount > 0
      ? `${assignedCount} item${assignedCount === 1 ? "" : "s"} · ${fmtGBP(assignedTotal)}`
      : "Assign packages & operatives for this day";

  const todayYmd = toYmd(new Date());
  const isPast = Boolean(selectedYmd && selectedYmd < todayYmd);
  const programmeLocked = Boolean(dayProgrammeQuery.data?.lockActive);
  const effectiveRow = liveRow ?? stubDailyRowFromTask(task, programmeLocked);
  const dayIsEmpty = selectedItems.length === 0;
  const canShowAddForm = canEditDay && !effectiveRow.isLocked && !isPast;

  function goToMonth(next: Date) {
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function shiftMonth(delta: number) {
    goToMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  function goToToday() {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedYmd(toYmd(today));
  }

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    if (isOffDayDate(day, offWeekdays, holidayYmds)) {
      toast.warning(OFF_DAY_ASSIGN_MESSAGE);
      return;
    }
    const ymd = toYmd(day);
    setSelectedYmd(ymd);
    setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    setDayModalOpen(true);
  }

  function closeDayModal() {
    setDayModalOpen(false);
  }

  return (
    <>
      <div className="card-elevated flex min-h-[32rem] w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm xl:min-h-[36rem]">
        <div className="flex shrink-0 flex-col gap-2 border-b bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Schedule
            </p>
            <h2 className="font-display text-base font-semibold tracking-tight">{monthTitle}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
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
              <SelectTrigger
                className="h-8 w-[8.5rem] shrink-0 bg-card [&>span]:whitespace-nowrap [&>span]:break-normal"
                aria-label="Select month"
              >
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
              onValueChange={(value) =>
                goToMonth(new Date(Number(value), month.getMonth(), 1))
              }
            >
              <SelectTrigger
                className="h-8 w-[5.5rem] shrink-0 bg-card [&>span]:whitespace-nowrap [&>span]:break-normal"
                aria-label="Select year"
              >
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
              className="h-8 w-8 shrink-0"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={goToToday}>
              Today
            </Button>
            {weekendQuery.isFetching && !weekendQuery.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        <div className="flex min-h-[26rem] flex-1 flex-col bg-gradient-to-b from-muted/15 to-transparent p-3 sm:min-h-[30rem] sm:p-4 lg:p-5">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={goToMonth}
            selected={selectedDate}
            onSelect={handleDaySelect}
            onDayClick={handleDaySelect}
            hideNavigation
            showOutsideDays
            fixedWeeks
            weekStartsOn={1}
            startMonth={minNavMonth}
            endMonth={maxNavMonth}
            modifiers={{
              hasWork: workDates,
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
              today: "bg-transparent text-foreground rounded-xl",
              day_button: "!aspect-auto !h-full !min-h-0 !min-w-0 !w-full rounded-xl p-0",
              outside: "opacity-50",
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
                <div className={cn("grid min-h-0 flex-1 grid-rows-6 gap-1.5", className)} {...props} />
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
              }: HTMLAttributes<HTMLDivElement> & {
                day?: unknown;
                modifiers?: unknown;
              }) => (
                <div
                  role="gridcell"
                  className={cn(className, "min-h-0 min-w-0 bg-transparent")}
                  {...props}
                />
              ),
              DayButton: (props) => {
                const ymd = toYmd(props.day.date);
                const dayItems = itemsByDate.get(ymd) ?? [];
                return (
                  <WorkDayCell
                    {...props}
                    items={dayItems}
                    isOffDay={isOffDayDate(props.day.date, offWeekdays, holidayYmds)}
                  />
                );
              },
            }}
          />
        </div>
      </div>

      <Modal
        open={dayModalOpen && Boolean(selectedYmd)}
        onClose={closeDayModal}
        title={modalTitle}
        subtitle={modalSubtitle}
        size="xl"
      >
        {dayProgrammeQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading day assignments…
          </div>
        ) : dayProgrammeQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
            <p className="text-sm font-medium">Unable to load day assignments</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(dayProgrammeQuery.error as unknown as ApiError)?.message || "Please try again."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void dayProgrammeQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {isPast ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Past date — tasks cannot be added or edited for previous dates.
              </p>
            ) : effectiveRow.isLocked ? (
              <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                Locked — complete previous-day ticks in Daily Programmer before editing.
              </p>
            ) : !canEditDay ? (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                You can view assignments. Modify permission is required to assign or remove items.
              </p>
            ) : null}
            <JobDayItemsEditor
              key={`${selectedYmd}-${effectiveRow.taskId}`}
              task={task}
              row={effectiveRow}
              date={selectedYmd!}
              disabled={!canEditDay || isPast}
              initialShowAdd={dayIsEmpty && canShowAddForm}
              onRowUpdated={setLiveRow}
            />
          </div>
        )}
      </Modal>
    </>
  );
}

function WorkDayCell({
  className,
  day,
  modifiers,
  items,
  isOffDay,
  ...props
}: ComponentProps<typeof DayButton> & {
  items: ApiTaskItem[];
  isOffDay: boolean;
}) {
  const hasWork = items.length > 0;
  const isSelected = Boolean(modifiers.selected);
  const isToday = Boolean(modifiers.today);
  const isOutside = Boolean(modifiers.outside);

  return (
    <button
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected={isSelected || undefined}
      className={cn(
        className,
        "flex h-full min-h-0 w-full flex-col items-stretch gap-1 overflow-hidden rounded-xl border p-1.5 text-left transition-all sm:p-2",
        isOutside && "border-transparent bg-muted/25 text-muted-foreground",
        !isOutside &&
          !hasWork &&
          !isOffDay &&
          "border-border/60 bg-card hover:border-accent/25 hover:bg-accent/[0.04]",
        isOffDay && !hasWork && !isOutside && "border-border/50 bg-muted/40",
        hasWork && !isSelected && "border-accent/30 bg-accent/[0.06] hover:bg-accent/10",
        isToday && !isSelected && "ring-1 ring-accent/45",
        isSelected && "border-accent bg-card shadow-md ring-2 ring-accent/35",
      )}
      {...props}
    >
      <span className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "text-sm font-semibold leading-none",
            isOutside ? "text-muted-foreground" : "text-foreground",
            isSelected && "text-accent",
          )}
        >
          {day.date.getDate()}
        </span>
        {hasWork ? (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold leading-none text-accent-foreground">
            {items.length}
          </span>
        ) : null}
      </span>

      {hasWork ? (
        <span className="mt-auto flex min-h-0 flex-1 flex-col justify-end gap-0.5 overflow-hidden">
          {items.slice(0, 2).map((item) => {
            const label = itemLabel(item);
            return (
              <AppTooltip key={item.id} content={label} asChild align="start">
                <span className="line-clamp-1 cursor-default rounded-md bg-card/90 px-1 py-0.5 text-[9px] font-medium leading-tight text-accent shadow-sm">
                  {label}
                </span>
              </AppTooltip>
            );
          })}
          {items.length > 2 ? (
            <span className="text-[9px] font-medium text-muted-foreground">
              +{items.length - 2} more
            </span>
          ) : null}
        </span>
      ) : isOffDay && !isOutside ? (
        <span className="mt-auto text-[9px] font-medium text-muted-foreground">Off</span>
      ) : null}
    </button>
  );
}
