import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AppTooltip } from "@/components/AppTooltip";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  DataTable,
  downloadCsv,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import {
  Lock,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  dailyProgrammeService,
  type ApiDailyClientExport,
  type ApiDailyClientExportBulk,
  type ApiDailyRow,
} from "@/lib/api/services/daily-programme";
import { tasksService, type ApiTaskItem } from "@/lib/api/services/tasks";
import { propertiesService } from "@/lib/api/services/properties";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { usePermission } from "@/components/Permission";
import { DAILY_ROUTE } from "@/lib/daily";
import { truncateWithEllipsis } from "@/lib/module-ui";
import { fmtGBP } from "@/lib/data";
import { formatUkDate } from "@/lib/week-ending";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/form";
import { DailyItemsCell } from "@/components/daily/DailyItemsCell";
import { DailyNameCell } from "@/components/daily/DailyNameCell";
import {
  dailyAssignmentSummary,
  filterNameOperativesWithoutOpenApprovals,
} from "@/lib/daily-packages";
import {
  fetchPropertyOptions,
  fetchTaskStatusOptions,
} from "@/lib/task-dropdowns";
import { StatusBadge } from "@/components/StatusBadge";

const dailySearchSchema = z.object({
  propertyId: z.string().optional(),
  projectId: z.string().optional(),
});

export const Route = createFileRoute("/daily")({
  validateSearch: dailySearchSchema,
  head: () => ({ meta: [{ title: "Daily Programmer | Schore" }] }),
  component: Daily,
});

export const dailyQueryKey = ["daily-programme"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function safeFilePart(value: string) {
  return value.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "job";
}

const CLIENT_EXPORT_HEADERS = [
  "Export date",
  "Job",
  "Property",
  "Address",
  "Postcode",
  "Property type",
  "Client",
  "Status",
  "Reason",
  "Operative",
  "Trade",
  "Task",
  "Attendance period",
] as const;

function buildClientExportRows(data: ApiDailyClientExport, exportDateLabel: string) {
  const status = data.status ?? "";
  const reason = data.reason ?? "";
  if (data.lines.length > 0) {
    return data.lines.map((line) => [
      exportDateLabel,
      data.taskNumber,
      data.propertyName,
      data.propertyAddress,
      data.postCode,
      data.propertyType,
      data.client,
      status,
      reason,
      line.operativeName,
      line.trade,
      line.task,
      line.attendancePeriod,
    ]);
  }

  return [
    [
      exportDateLabel,
      data.taskNumber,
      data.propertyName,
      data.propertyAddress,
      data.postCode,
      data.propertyType,
      data.client,
      status,
      reason,
      "",
      "",
      "",
      "",
    ],
  ];
}

function downloadClientNextDayCsv(data: ApiDailyClientExport) {
  const exportDateLabel = formatUkDate(data.exportDate);
  const filename = `next-day-${safeFilePart(data.propertyName || data.taskNumber)}-${data.exportDate}.csv`;
  downloadCsv({
    filename,
    headers: [...CLIENT_EXPORT_HEADERS],
    rows: buildClientExportRows(data, exportDateLabel),
  });
}

function downloadClientNextDayBulkCsv(data: ApiDailyClientExportBulk) {
  const exportDateLabel = formatUkDate(data.exportDate);
  const filename = `next-day-filtered-${data.exportDate}.csv`;
  const rows =
    data.jobs.length > 0
      ? data.jobs.flatMap((job) => buildClientExportRows(job, exportDateLabel))
      : [];
  downloadCsv({
    filename,
    headers: [...CLIENT_EXPORT_HEADERS],
    rows,
  });
}


function matchesSearch(row: ApiDailyRow, search: string) {
  if (!search) return true;
  const q = search.toLowerCase();
  const haystack = [
    row.taskNumber,
    row.propertyName,
    row.propertyAddress,
    row.contract,
    row.postCode,
    row.type,
    row.statusName,
    row.statusCode,
    row.reason,
    row.tradeOrStatus,
    row.nameDisplay,
    row.notesDisplay,
    row.previousDayTrades,
    row.previousDayDetails,
    row.nextDayTrades,
    row.nextDayDetails,
    row.nextDay,
    ...(row.assignedByOperative ?? []).flatMap((op) => [
      ...op.packages.map((pkg) => pkg.tradeGroupName),
      ...op.addOns.map((a) => a.productName),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function Daily() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { propertyId: propertyIdSearch, projectId: projectIdSearch } = Route.useSearch();
  const filterPropertyId = propertyIdSearch?.trim() ?? "";
  const hasPropertyFilter = filterPropertyId.length > 0;
  const canModifyDaily = usePermission({ route: DAILY_ROUTE, action: "modify" });
  const [date, setDate] = useState(todayIso);
  const [showHO, setShowHO] = useState(false);
  const [confirmRoll, setConfirmRoll] = useState(false);
  const [completedModal, setCompletedModal] = useState<{
    taskId: string;
    propertyName: string;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [propertyLabel, setPropertyLabel] = useState<string | null>(null);
  const [statusId, setStatusId] = useState("");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [exportingTaskId, setExportingTaskId] = useState<string | null>(null);
  const [exportingBulk, setExportingBulk] = useState(false);
  const filterStatusId = statusId.trim();
  const hasStatusFilter = filterStatusId.length > 0;
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  useEffect(() => {
    setPage(1);
  }, [propertyIdSearch, statusId]);

  const query = useQuery({
    queryKey: [
      ...dailyQueryKey,
      date,
      showHO,
      hasPropertyFilter ? filterPropertyId : null,
      hasStatusFilter ? filterStatusId : null,
      projectIdSearch ?? null,
    ],
    queryFn: async () =>
      (
        await dailyProgrammeService.get({
          date,
          showHandedOver: showHO,
          propertyId: hasPropertyFilter ? filterPropertyId : undefined,
          statusId: hasStatusFilter ? filterStatusId : undefined,
          projectId: projectIdSearch || undefined,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const propertyLookupQuery = useQuery({
    queryKey: ["properties", filterPropertyId, "daily-filter-label"],
    queryFn: async () => (await propertiesService.get(filterPropertyId)).data,
    enabled: hasPropertyFilter && !propertyLabel?.trim(),
    staleTime: 60_000,
  });

  const completedItemsQuery = useQuery({
    queryKey: ["tasks", completedModal?.taskId, "completed-items"],
    queryFn: async () => {
      const task = (await tasksService.get(completedModal!.taskId)).data;
      const items = (task?.items ?? [])
        .filter((item) => item.isTicked)
        .sort((a, b) => completedItemSortKey(b) - completedItemSortKey(a));
      return { task, items };
    },
    enabled: completedModal != null,
  });

  const rollMutation = useMutation({
    mutationFn: () => dailyProgrammeService.rollForward(date),
    onSuccess: (res) => {
      toast.success(res.message || "Rolled forward");
      setConfirmRoll(false);
      const next = res.data?.nextDate?.slice(0, 10);
      if (next) setDate(next);
      setPage(1);
      void qc.invalidateQueries({ queryKey: dailyQueryKey });
    },
    onError: (err) => notifyApiError(err, "Unable to roll forward"),
  });

  const data = query.data;
  const allRows: ApiDailyRow[] = data?.rows ?? [];

  const filteredRows = useMemo(
    () => allRows.filter((row) => matchesSearch(row, search)),
    [allRows, search],
  );

  const propertyFilterLabel = useMemo(() => {
    if (!hasPropertyFilter) return null;
    if (propertyLabel?.trim()) return propertyLabel.trim();
    const fromLookup = propertyLookupQuery.data?.propertyName?.trim();
    if (fromLookup) return fromLookup;
    const match = allRows.find((row) => row.propertyId === filterPropertyId);
    return match?.propertyName?.trim() || `Property #${filterPropertyId}`;
  }, [
    allRows,
    filterPropertyId,
    hasPropertyFilter,
    propertyLabel,
    propertyLookupQuery.data?.propertyName,
  ]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSafe, pageSize]);

  function clearPropertyFilter() {
    setPropertyLabel(null);
    void navigate({
      to: "/daily",
      search: {},
      replace: true,
    });
    setPage(1);
  }

  function setPropertyFilter(nextId: string, nextLabel?: string | null) {
    if (!nextId) {
      clearPropertyFilter();
      return;
    }
    setPropertyLabel(nextLabel?.trim() || null);
    void navigate({
      to: "/daily",
      search: { propertyId: nextId },
      replace: true,
    });
    setPage(1);
  }

  function clearStatusFilter() {
    setStatusId("");
    setStatusLabel(null);
    setPage(1);
  }

  function clearFilters() {
    clearSearch();
    setShowHO(false);
    setDate(todayIso());
    clearStatusFilter();
    setPage(1);
    if (hasPropertyFilter) {
      clearPropertyFilter();
    }
  }

  const today = todayIso();
  const isDateFiltered = date !== today;
  const isAtOrPastToday = date >= today;
  const hasActiveFilters = Boolean(
    search || showHO || isDateFiltered || hasPropertyFilter || hasStatusFilter,
  );

  const columns = useMemo<DataTableColumn<ApiDailyRow>[]>(
    () => {
      const cols: DataTableColumn<ApiDailyRow>[] = [
      {
        id: "no",
        header: "No.",
        width: "3.5rem",
        accessor: (row) => row.no,
        cell: (row) => <span className="tabular-nums text-muted-foreground">{row.no}</span>,
      },
      {
        id: "property",
        header: "Property",
        width: "12rem",
        truncate: false,
        accessor: (row) =>
          [
            row.propertyName,
            row.propertyAddress,
            row.accessNotes,
            row.previousDayTrades ? `Previous day: ${row.previousDayTrades}` : null,
            row.isLocked ? "Locked — no tick on previous day" : null,
            row.isOverdue ? "Overdue — hand-over date passed" : null,
          ]
            .filter(Boolean)
            .join(" · "),
        cell: (row) => {
          const propertyTooltip = [
            row.propertyName,
            row.propertyAddress,
            row.accessNotes,
            row.previousDayTrades ? `Previous day: ${row.previousDayTrades}` : null,
            row.isLocked ? "Locked — no tick on previous day" : null,
            row.isOverdue ? "Overdue — hand-over date passed" : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <div className="flex min-w-0 items-center gap-1.5">
              {row.isOverdue ? (
                <AppTooltip content="Overdue" asChild>
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full bg-destructive"
                    aria-label="Overdue"
                    role="img"
                  />
                </AppTooltip>
              ) : null}
              {row.isLocked ? (
                <Lock
                  className="h-3.5 w-3.5 shrink-0 text-warning-foreground"
                  aria-label="Locked"
                />
              ) : null}
              <AppTooltip content={propertyTooltip} asChild align="start">
                <Link
                  to="/tasks/$id"
                  params={{ id: String(row.taskId) }}
                  search={{
                    mode: canModifyDaily ? "edit" : "view",
                    from: "daily",
                  }}
                  className="inline-block max-w-full truncate font-medium hover:text-info"
                >
                  {truncateWithEllipsis(row.propertyName, 36)}
                </Link>
              </AppTooltip>
            </div>
          );
        },
      },
      {
        id: "contract",
        header: "Client",
        width: "11rem",
        accessor: (row) => row.contract || "—",
        cell: (row) => {
          const value = row.contract?.trim() || "—";
          if (value === "—") return "—";
          return (
            <AppTooltip content={value} asChild align="start">
              <code className="block max-w-full truncate whitespace-nowrap font-mono text-xs">
                {value}
              </code>
            </AppTooltip>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        width: "6rem",
        accessor: (row) => row.type || "—",
      },
      {
        id: "startingDate",
        header: "Starting Date",
        width: "7rem",
        accessor: (row) => formatUkDate(row.startingDate),
        cell: (row) => (
          <span className="tabular-nums">{formatUkDate(row.startingDate)}</span>
        ),
      },
      {
        id: "day",
        header: "DAY",
        width: "5rem",
        accessor: (row) => String(row.daysCount),
        cell: (row) => (
          <span className="font-mono tabular-nums">{row.daysCount}</span>
        ),
      },
      {
        id: "previousDay",
        header: "Previous day",
        width: "7rem",
        truncate: false,
        accessor: (row) => row.previousDayTrades || row.previousDayDetails || "—",
        cell: (row) => {
          const trades = row.previousDayTrades?.trim();
          const details = row.previousDayDetails?.trim();
          if (!trades && !details) return "—";
          const label = trades || details!.split("\n")[0] || "—";
          return (
            <AppTooltip
              content={details || trades}
              contentClassName="whitespace-pre-line"
              asChild
              align="start"
            >
              <span className="block max-w-full cursor-default truncate font-mono text-xs uppercase">
                {truncateWithEllipsis(label, 16)}
              </span>
            </AppTooltip>
          );
        },
      },
      {
        id: "nextDayCol",
        header: "Next day",
        width: "7rem",
        truncate: false,
        accessor: (row) => row.nextDayTrades || "—",
        cell: (row) => {
          const trades = row.nextDayTrades?.trim();
          if (!trades) return "—";
          const details = row.nextDayDetails?.trim() || trades;
          return (
            <AppTooltip
              content={details}
              contentClassName="whitespace-pre-line"
              asChild
              align="start"
            >
              <span className="block max-w-full cursor-default truncate font-mono text-xs uppercase">
                {truncateWithEllipsis(trades, 16)}
              </span>
            </AppTooltip>
          );
        },
      },
      {
        id: "trade",
        header: "Trade",
        width: "6rem",
        truncate: false,
        accessor: (row) => row.tradeOrStatus || "—",
        cell: (row) => {
          const value = row.tradeOrStatus?.trim() || "—";
          if (value === "—") return "—";
          const isStatus = value === "hold" || value === "HO";
          return (
            <AppTooltip content={value} asChild align="start">
              <span
                className={cn(
                  "block max-w-full truncate font-mono text-xs uppercase",
                  isStatus && "italic text-muted-foreground",
                )}
              >
                {truncateWithEllipsis(value, 14)}
              </span>
            </AppTooltip>
          );
        },
      },
      {
        id: "name",
        header: "Name",
        width: "9rem",
        truncate: false,
        accessor: (row) =>
          filterNameOperativesWithoutOpenApprovals(row.nameOperatives ?? [])
            .map((op) => op.operativeName)
            .join(", ") || "No allocation",
        cell: (row) => (
          <DailyNameCell row={row} date={date} disabled={!canModifyDaily} />
        ),
      },
      {
        id: "items",
        header: "Items",
        width: "10rem",
        truncate: false,
        accessor: (row) => dailyAssignmentSummary(row.assignedByOperative ?? []),
        cell: (row) => (
          <DailyItemsCell row={row} date={date} disabled={!canModifyDaily} />
        ),
      },
      {
        id: "notes",
        header: "Notes",
        width: "8rem",
        truncate: false,
        accessor: (row) => row.notesDisplay || "—",
        cell: (row) => {
          const notes = row.notesDisplay?.trim();
          if (!notes) return "—";
          return (
            <AppTooltip content={notes} asChild align="start">
              <span className="block max-w-full cursor-default truncate text-muted-foreground">
                {truncateWithEllipsis(notes, 32)}
              </span>
            </AppTooltip>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        width: "8rem",
        truncate: false,
        accessor: (row) => row.statusName || row.statusCode || "—",
        cell: (row) => {
          const label = row.statusName?.trim() || row.statusCode?.trim();
          if (!label) return "—";
          return <StatusBadge status={label} />;
        },
      },
      {
        id: "reason",
        header: "Reason",
        width: "10rem",
        truncate: false,
        accessor: (row) => row.reason || "—",
        cell: (row) => {
          const reason = row.reason?.trim();
          if (!reason) return "—";
          return (
            <AppTooltip content={reason} asChild align="start">
              <span className="block max-w-full cursor-default truncate text-muted-foreground">
                {truncateWithEllipsis(reason, 36)}
              </span>
            </AppTooltip>
          );
        },
      },
      {
        id: "time",
        header: "Time",
        width: "6rem",
        accessor: (row) => row.timeDisplay || "—",
      },
    ];
    return cols;
  }, [canModifyDaily, date]);

  async function exportNextDayForClient(row: ApiDailyRow) {
    if (exportingTaskId || exportingBulk) return;
    setExportingTaskId(row.taskId);
    try {
      const res = await dailyProgrammeService.clientNextDayExport(row.taskId, date);
      const data = res.data;
      if (!data) {
        toast.error("Unable to export next-day schedule");
        return;
      }
      if (!data.lines?.length) {
        toast.warning("No task items scheduled for the next day on this job");
      }
      downloadClientNextDayCsv(data);
      toast.success(
        data.lines?.length
          ? `Exported next-day schedule (${formatUkDate(data.exportDate)})`
          : `Exported empty next-day schedule (${formatUkDate(data.exportDate)})`,
      );
    } catch (err) {
      notifyApiError(err, "Unable to export next-day schedule");
    } finally {
      setExportingTaskId(null);
    }
  }

  async function exportFilteredNextDay() {
    if (exportingBulk || exportingTaskId) return;
    if (filteredRows.length === 0) {
      toast.warning("No properties match the current filters");
      return;
    }
    setExportingBulk(true);
    try {
      const res = await dailyProgrammeService.clientNextDayExportBulk(
        date,
        filteredRows.map((row) => row.taskId),
      );
      const data = res.data;
      if (!data) {
        toast.error("Unable to export next-day schedule");
        return;
      }
      const lineCount = data.jobs.reduce((sum, job) => sum + (job.lines?.length ?? 0), 0);
      if (lineCount === 0) {
        toast.warning("No task items scheduled for the next day on the filtered jobs");
      }
      downloadClientNextDayBulkCsv(data);
      toast.success(
        `Exported ${data.jobs.length} job${data.jobs.length === 1 ? "" : "s"} (${formatUkDate(data.exportDate)})`,
      );
    } catch (err) {
      notifyApiError(err, "Unable to export next-day schedule");
    } finally {
      setExportingBulk(false);
    }
  }

  const getRowActions = useMemo(() => {
    return (row: ApiDailyRow): DataTableRowAction<ApiDailyRow>[] => [
      {
        id: "export-next-day",
        label: "Export next day (client)",
        variant: "icon",
        icon:
          exportingTaskId === row.taskId ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          ),
        onClick: (actionRow) => {
          void exportNextDayForClient(actionRow);
        },
      },
    ];
  }, [date, exportingTaskId, exportingBulk]);

  const assignedProjects = query.data?.assignedProjects ?? [];
  const showProjectSwitcher = (query.data?.separateProjectViews ?? false) && assignedProjects.length > 0;

  return (
    <div className="space-y-4">
      {showProjectSwitcher ? (
        <div className="flex flex-wrap gap-2">
          {assignedProjects.map((project) => {
            const selected =
              (projectIdSearch || query.data?.selectedProjectId || "") === project.id;
            return (
              <Button
                key={project.id}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                onClick={() =>
                  navigate({
                    to: "/daily",
                    search: (prev) => ({ ...prev, projectId: project.id }),
                  })
                }
              >
                {project.code} · {project.name}
              </Button>
            );
          })}
        </div>
      ) : null}
      {query.data?.requireProjectSelection && !projectIdSearch ? (
        <p className="text-sm text-muted-foreground">
          Select a project to see its properties. Site Managers do not get a merged view across projects.
        </p>
      ) : null}
      <PageHeader
        title="Daily Programmer"
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-input bg-background">
              <button
                type="button"
                className="grid h-9 w-9 place-items-center hover:bg-accent/10"
                onClick={() => {
                  setDate((d) => shiftDate(d, -1));
                  setPage(1);
                }}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  setDate(next > today ? today : next);
                  setPage(1);
                }}
                className="h-9 border-x border-input bg-transparent px-2 text-sm outline-none"
                aria-label="Programme date"
              />
              <button
                type="button"
                className="grid h-9 w-9 place-items-center hover:bg-accent/10 disabled:pointer-events-none disabled:opacity-40"
                disabled={isAtOrPastToday}
                onClick={() => {
                  setDate((d) => {
                    const next = shiftDate(d, 1);
                    return next > today ? today : next;
                  });
                  setPage(1);
                }}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <AppTooltip content="Clear date (reset to today)" asChild>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center border-l border-input text-muted-foreground hover:bg-accent/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => {
                    setDate(todayIso());
                    setPage(1);
                  }}
                  disabled={!isDateFiltered}
                  aria-label="Clear date filter"
                >
                  <X className="h-4 w-4" />
                </button>
              </AppTooltip>
            </div>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs">
              <Checkbox
                checked={showHO}
                onCheckedChange={(checked) => {
                  setShowHO(checked === true);
                  setPage(1);
                }}
                aria-label="Show handed-over"
              />
              Show handed-over
            </label>
            <SearchableSelect
              value={hasPropertyFilter ? filterPropertyId : ""}
              onValueChange={(value) => {
                if (!value) clearPropertyFilter();
              }}
              onSelect={(option) => {
                if (!option.value) {
                  clearPropertyFilter();
                  return;
                }
                setPropertyFilter(option.value, option.label);
              }}
              placeholder="All properties"
              searchPlaceholder="Search properties…"
              aria-label="Filter by property"
              queryKey={["lookups", "properties", "daily-filter"]}
              fetchOptions={fetchPropertyOptions}
              selectedLabel={propertyFilterLabel}
              emptyOption={{ value: "", label: "All properties" }}
              className="w-full min-w-[11rem] sm:w-52"
              triggerClassName="h-9 [&>span]:whitespace-nowrap"
            />
            <SearchableSelect
              value={statusId}
              onValueChange={(value) => {
                if (!value) {
                  clearStatusFilter();
                  return;
                }
                setStatusId(value);
                setPage(1);
              }}
              onSelect={(option) => {
                if (!option.value) {
                  clearStatusFilter();
                  return;
                }
                setStatusId(option.value);
                setStatusLabel(option.label?.trim() || null);
                setPage(1);
              }}
              placeholder="All statuses"
              searchPlaceholder="Search statuses…"
              aria-label="Filter by status"
              queryKey={["lookups", "task-statuses", "daily-filter"]}
              fetchOptions={fetchTaskStatusOptions}
              selectedLabel={statusLabel}
              emptyOption={{ value: "", label: "All statuses" }}
              className="w-full min-w-[11rem] sm:w-52"
              triggerClassName="h-9 [&>span]:whitespace-nowrap"
            />
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.taskId}
        loading={query.isLoading}
        fetching={query.isFetching}
        loadingText="Loading daily programmer…"
        stickyActions
        actionsHeaderHidden
        actionsColumnWidth="3.25rem"
        rowActions={getRowActions}
        error={
          query.isError
            ? {
                title: "Unable to load daily programmer",
                message: (query.error as unknown as ApiError)?.message || "Please try again.",
                onRetry: () => {
                  void query.refetch();
                },
              }
            : null
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Search property, client, trade…",
          "aria-label": "Search daily programmer",
        }}
        toolbarActions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={exportingBulk || exportingTaskId != null || filteredRows.length === 0}
            onClick={() => {
              void exportFilteredNextDay();
            }}
          >
            {exportingBulk ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export
          </Button>
        }
        emptyState={{
          title: hasActiveFilters ? "No rows match your filters" : "No properties on today's roll",
          description: hasActiveFilters ? "Try clearing the search or filters." : undefined,
          action: hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined,
        }}
        pagination={{
          page: pageSafe,
          pageSize,
          totalCount,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          itemLabel: "rows",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {confirmRoll ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">Roll forward to next day?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              In-progress properties carry forward. Handed-over properties drop off the default
              board. Next day&apos;s allocations stay empty for the SM to plan.
            </p>
            <div className="mt-4 space-y-1 rounded-md bg-secondary p-3 text-xs">
              <div>
                <span className="text-muted-foreground">In progress carrying forward: </span>
                <strong>{data?.inProgressCount ?? 0}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">On hold: </span>
                <strong>{data?.onHoldCount ?? 0}</strong>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmRoll(false)}
                disabled={rollMutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={() => rollMutation.mutate()} disabled={rollMutation.isPending}>
                {rollMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm roll
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={completedModal != null}
        onClose={() => setCompletedModal(null)}
        title="Completed items"
        subtitle={
          completedModal
            ? `${completedModal.propertyName}${
                completedItemsQuery.data?.task?.taskNumber
                  ? ` · ${completedItemsQuery.data.task.taskNumber}`
                  : ""
              }`
            : undefined
        }
        size="lg"
      >
        <CompletedItemsModalBody
          key={completedModal?.taskId ?? "closed"}
          loading={completedItemsQuery.isLoading}
          error={completedItemsQuery.isError}
          onRetry={() => {
            void completedItemsQuery.refetch();
          }}
          items={completedItemsQuery.data?.items ?? []}
        />
      </Modal>
    </div>
  );
}

function completedItemSortKey(item: ApiTaskItem) {
  const raw = item.completedDate || item.workDate;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function CompletedItemsModalBody({
  loading,
  error,
  onRetry,
  items,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  items: ApiTaskItem[];
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSafe, pageSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading completed items…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">Unable to load completed items.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No completed items for this job yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Completed</th>
              <th className="px-3 py-2.5 text-left font-medium">Work date</th>
              <th className="px-3 py-2.5 text-left font-medium">Operative</th>
              <th className="px-3 py-2.5 text-left font-medium">Trade</th>
              <th className="px-3 py-2.5 text-left font-medium">Item</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageRows.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  {formatUkDate(item.completedDate)}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{formatUkDate(item.workDate)}</td>
                <td className="px-3 py-2.5 font-medium">{item.operativeName}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{item.tradeName || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{item.productName || "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {fmtGBP(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={pageSafe}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        itemLabel="items"
        controlsAlign="center"
      />
    </div>
  );
}
