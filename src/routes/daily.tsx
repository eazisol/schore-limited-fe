import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AppTooltip } from "@/components/AppTooltip";
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
  Loader2,
  Plus,
  Eye,
  Pencil,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { dailyProgrammeService, type ApiDailyRow } from "@/lib/api/services/daily-programme";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { Can, usePermission } from "@/components/Permission";
import { DAILY_ROUTE } from "@/lib/daily";
import { truncateWithEllipsis } from "@/lib/module-ui";

export const Route = createFileRoute("/daily")({
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

function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
    row.tradeOrStatus,
    row.nameDisplay,
    row.notesDisplay,
    row.nextDay,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function Daily() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canModifyDaily = usePermission({ route: DAILY_ROUTE, action: "modify" });
  const [date, setDate] = useState(todayIso);
  const [showHO, setShowHO] = useState(false);
  const [confirmRoll, setConfirmRoll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const openTask = useCallback(
    (taskId: number, mode: "view" | "edit") => {
      navigate({
        to: "/tasks/$id",
        params: { id: String(taskId) },
        search: {
          mode: mode === "edit" && canModifyDaily ? "edit" : "view",
          from: "daily",
        },
      });
    },
    [canModifyDaily, navigate],
  );

  const query = useQuery({
    queryKey: [...dailyQueryKey, date, showHO],
    queryFn: async () => (await dailyProgrammeService.get(date, showHO)).data,
    placeholderData: keepPreviousData,
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
  const allRows = data?.rows ?? [];

  const filteredRows = useMemo(
    () => allRows.filter((row) => matchesSearch(row, search)),
    [allRows, search],
  );

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSafe, pageSize]);

  const kpis = useMemo(
    () => [
      { label: "In Progress", value: data?.inProgressCount ?? 0, tone: "info" as const },
      { label: "On Hold", value: data?.onHoldCount ?? 0, tone: "warn" as const },
      { label: "On roll", value: allRows.length, tone: "ok" as const },
      {
        label: "Operatives on Site",
        value: data?.operativesOnSiteCount ?? 0,
        tone: "ok" as const,
      },
    ],
    [data, allRows.length],
  );

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No rows to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `daily-programmer-${date}.csv`,
        headers: [
          "No.",
          "Task #",
          "Property",
          "Address",
          "Contractor",
          "Post Code",
          "Type",
          "Starting Date",
          "HO",
          "DAY",
          "Held Days",
          "Trade / Status",
          "Name",
          "Notes",
          "Time",
          "Next Day",
          "Locked",
        ],
        rows: rows.map((row) => [
          row.no,
          row.taskNumber,
          row.propertyName,
          row.propertyAddress ?? "",
          row.contract ?? "",
          row.postCode ?? "",
          row.type ?? "",
          row.startingDate?.slice(0, 10) ?? "",
          row.handOverDate?.slice(0, 10) ?? "",
          row.daysCount,
          row.heldDaysCount,
          row.tradeOrStatus || "",
          row.nameDisplay ?? "",
          row.notesDisplay ?? "",
          row.timeDisplay ?? "",
          row.nextDay ?? "",
          row.isLocked ? "Yes" : "No",
        ]),
      });
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    clearSearch();
    setShowHO(false);
    setDate(todayIso());
    setPage(1);
  }

  const today = todayIso();
  const isDateFiltered = date !== today;
  const isAtOrPastToday = date >= today;
  const hasActiveFilters = Boolean(search || showHO || isDateFiltered);

  const columns = useMemo<DataTableColumn<ApiDailyRow>[]>(
    () => [
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
        width: "14rem",
        truncate: false,
        accessor: (row) =>
          [row.propertyName, row.propertyAddress, row.accessNotes].filter(Boolean).join(" · "),
        cell: (row) => {
          const propertyLine = [row.propertyAddress, row.accessNotes].filter(Boolean).join(" · ");
          const propertyTooltip = [row.propertyName, row.propertyAddress, row.accessNotes]
            .filter(Boolean)
            .join(" · ");
          return (
            <div className="flex items-start gap-1.5">
              {row.isLocked ? (
                <Lock
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-foreground"
                  aria-label="Locked"
                />
              ) : null}
              <div className="min-w-0">
                <AppTooltip content={propertyTooltip} asChild align="start">
                  <Link
                    to="/tasks/$id"
                    params={{ id: String(row.taskId) }}
                    search={{
                      mode: canModifyDaily ? "edit" : "view",
                      from: "daily",
                    }}
                    className="inline-block max-w-full font-medium hover:text-info hover:underline"
                  >
                    {truncateWithEllipsis(row.propertyName, 40)}
                  </Link>
                </AppTooltip>
                {propertyLine ? (
                  <AppTooltip content={propertyLine} asChild align="start">
                    <div className="mt-0.5 max-w-full cursor-default truncate text-[11px] text-muted-foreground">
                      {propertyLine}
                    </div>
                  </AppTooltip>
                ) : null}
                {row.previousDayName ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Yesterday: {row.previousDayName}
                  </div>
                ) : null}
                {row.isLocked ? (
                  <div className="mt-1 text-[11px] font-medium text-warning-foreground">
                    Locked — no tick on previous day
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "contract",
        header: "Contractor",
        width: "7rem",
        accessor: (row) => row.contract || "—",
        cell: (row) => <code className="font-mono text-xs">{row.contract || "—"}</code>,
      },
      {
        id: "postCode",
        header: "Post Code",
        width: "6rem",
        accessor: (row) => row.postCode || "—",
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
        accessor: (row) => row.startingDate?.slice(0, 10) || "—",
        cell: (row) => (
          <span className="tabular-nums">{row.startingDate?.slice(0, 10) || "—"}</span>
        ),
      },
      {
        id: "ho",
        header: "HO",
        width: "6.5rem",
        accessor: (row) => row.handOverDate?.slice(0, 10) || "—",
        cell: (row) => (
          <span className="tabular-nums">{row.handOverDate?.slice(0, 10) || "—"}</span>
        ),
      },
      {
        id: "day",
        header: "DAY",
        width: "5rem",
        accessor: (row) =>
          row.heldDaysCount > 0
            ? `${row.daysCount} (-${row.heldDaysCount})`
            : String(row.daysCount),
        cell: (row) => (
          <span className="font-mono tabular-nums">
            {row.daysCount}
            {row.heldDaysCount > 0 ? (
              <span className="ml-1 text-[11px] text-muted-foreground">(-{row.heldDaysCount})</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "tradeOrStatus",
        header: "Trade / Status",
        width: "8rem",
        accessor: (row) => row.tradeOrStatus || "—",
        cell: (row) => (
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
            {row.tradeOrStatus || "—"}
          </code>
        ),
      },
      {
        id: "name",
        header: "Name",
        width: "10rem",
        truncate: false,
        accessor: (row) =>
          [row.nameDisplay, row.notesDisplay].filter(Boolean).join(" · ") || "No allocation",
        cell: (row) =>
          !row.nameDisplay ? (
            <span className="italic text-muted-foreground">No allocation</span>
          ) : (
            <div>
              <div className="font-medium">{row.nameDisplay}</div>
              {row.notesDisplay ? (
                <div className="mt-0.5 text-[11px] text-muted-foreground">{row.notesDisplay}</div>
              ) : null}
            </div>
          ),
      },
      {
        id: "time",
        header: "Time",
        width: "6rem",
        accessor: (row) => row.timeDisplay || "—",
      },
      {
        id: "nextDay",
        header: (
          <AppTooltip content="Suggested codes for this working day — never auto-applied">
            <span>Next Day</span>
          </AppTooltip>
        ),
        width: "6rem",
        accessor: (row) => row.nextDay || "—",
        cell: (row) =>
          row.nextDay ? (
            <AppTooltip content="Suggestion only — confirm work, then choose next step">
              <span>{row.nextDay}</span>
            </AppTooltip>
          ) : (
            "—"
          ),
      },
    ],
    [canModifyDaily],
  );

  const rowActions = useMemo<DataTableRowAction<ApiDailyRow>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (row) => openTask(row.taskId, "view"),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModifyDaily,
        onClick: (row) => openTask(row.taskId, "edit"),
      },
    ],
    [canModifyDaily, openTask],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Programmer"
        subtitle={`Roll for ${formatLongDate(date)}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || query.isLoading}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export CSV
            </Button>
            <Can route={DAILY_ROUTE} action="modify">
              <Button
                size="sm"
                onClick={() => navigate({ to: "/tasks/new", search: { from: "daily" } })}
              >
                <Plus className="h-4 w-4" />
                Add task
              </Button>
            </Can>
            {/* Hidden: auto roll-forward runs at midnight UTC
            <Can route={DAILY_ROUTE} action="modify">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmRoll(true)}
                disabled={!data?.canRollForward || rollMutation.isPending}
              >
                {data?.canRollForward
                  ? "Roll forward to next day"
                  : "Tick at least one to roll forward"}
              </Button>
            </Can>
            */}
          </>
        }
      />

      {data?.lockActive ? (
        <div className="card-elevated flex items-start gap-3 border-warning/30 bg-warning/5 p-4">
          <Lock className="mt-0.5 h-4 w-4 text-warning-foreground" />
          <div className="text-sm">
            <div className="font-medium">Some tasks are locked</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {data.lockMessage ||
                "Tick at least one allocation on the previous working day for each locked task before adding today's work."}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Counter key={k.label} label={k.label} value={k.value} tone={k.tone} />
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.taskId}
        loading={query.isLoading}
        fetching={query.isFetching}
        loadingText="Loading daily programmer…"
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
          placeholder: "Search property, contractor, trade…",
          "aria-label": "Search daily programmer",
        }}
        filters={
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
          </>
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
        rowActions={rowActions}
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
    </div>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "warn" | "ok" | "destructive";
}) {
  const toneCls =
    tone === "warn"
      ? "text-warning-foreground"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "info"
          ? "text-info"
          : "text-success";
  return (
    <div className="card-elevated p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
