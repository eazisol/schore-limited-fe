import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  downloadCsv,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { Plus, Eye, Pencil, Trash2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { tradesService, type ApiTrade, type TradesSortBy } from "@/lib/api/services/trades";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppTooltip } from "@/components/AppTooltip";
import { activeStatusClass } from "@/lib/module-ui";

const TRADES_ROUTE = "/trade-builder";

export const Route = createFileRoute("/trade-builder/")({
  head: () => ({ meta: [{ title: "Trade Management | Schore" }] }),
  component: TradesList,
});

export const tradesQueryKey = ["trades"] as const;

const COLUMN_SORT_KEYS: Record<string, TradesSortBy> = {
  name: "name",
  groups: "groups",
  tasks: "tasks",
  status: "status",
};

function TradesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: TRADES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: TRADES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<"active" | "inactive" | undefined>(undefined);
  const [sortBy, setSortBy] = useState<TradesSortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [confirmDel, setConfirmDel] = useState<ApiTrade | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...tradesQueryKey, { page, pageSize, search, status, sortBy, sortDir }],
    queryFn: async () =>
      (await tradesService.list({ page, pageSize, search, status, sortBy, sortDir })).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tradesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Trade deleted");
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: tradesQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete trade"),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No trades to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `trades-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Groups", "Tasks", "Status"],
        rows: rows.map((t) => [
          t.name,
          String(t.groupCount),
          String(t.taskCount),
          t.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(`Exported ${rows.length} trade${rows.length === 1 ? "" : "s"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiTrade>[]>(
    () => [
      {
        id: "name",
        header: "Trade",
        sortable: true,
        cell: (trade) => (
          <div className="min-w-0">
            <AppTooltip content={trade.name} asChild>
              <Link
                to="/trade-builder/$id"
                params={{ id: String(trade.id) }}
                className="block truncate font-medium hover:text-info hover:underline"
              >
                {trade.name}
              </Link>
            </AppTooltip>
            {trade.description ? (
              <div className="truncate text-[11px] text-muted-foreground">{trade.description}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "groups",
        header: "Groups",
        sortable: true,
        cell: (trade) => (
          <span className="font-mono tabular-nums">{trade.groupCount}</span>
        ),
      },
      {
        id: "tasks",
        header: "Tasks",
        sortable: true,
        cell: (trade) => (
          <span className="font-mono tabular-nums">{trade.taskCount}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (trade) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(trade.isActive)}`}
          >
            {trade.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiTrade>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (trade) =>
          navigate({ to: "/trade-builder/$id", params: { id: String(trade.id) } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (trade) =>
          navigate({
            to: "/trade-builder/$id",
            params: { id: String(trade.id) },
            search: { mode: "edit" },
          }),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (trade) => setConfirmDel(trade),
      },
    ],
    [canDelete, canModify, navigate],
  );

  const activeSortColumn =
    Object.entries(COLUMN_SORT_KEYS).find(([, apiKey]) => apiKey === sortBy)?.[0] ?? "name";

  function handleSortChange(columnId: string, direction: "asc" | "desc") {
    const apiSortBy = COLUMN_SORT_KEYS[columnId];
    if (!apiSortBy) return;
    setSortBy(apiSortBy);
    setSortDir(direction);
    setPage(1);
  }

  function clearFilters() {
    clearSearch();
    setStatus(undefined);
    setPage(1);
  }

  const hasActiveFilters = Boolean(search) || status != null;

  return (
    <div>
      <PageHeader
        title="Trade Management"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || isLoading}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </Button>
            <Can route={TRADES_ROUTE} action="modify">
              <Button size="sm" asChild>
                <Link to="/trade-builder/new">
                  <Plus className="h-4 w-4" />
                  Add trade
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(trade) => trade.id}
        loading={isLoading}
        fetching={isFetching}
        loadingText="Loading trades…"
        error={
          isError
            ? {
                title: "Unable to load trades",
                message: (error as unknown as ApiError)?.message || "Please try again.",
                onRetry: () => {
                  void refetch();
                },
              }
            : null
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Search by trade name…",
          "aria-label": "Search trades",
        }}
        filters={
          <Select
            value={status ?? "all"}
            onValueChange={(value) => {
              setStatus(value === "all" ? undefined : (value as "active" | "inactive"));
              setPage(1);
            }}
          >
            <SelectTrigger
              className="h-9 w-full min-w-[11rem] sm:w-60 [&>span]:whitespace-nowrap"
              aria-label="Filter by status"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        }
        sort={{
          sortBy: activeSortColumn,
          sortDir,
          onSortChange: handleSortChange,
        }}
        emptyState={{
          title: "No trades match your filters",
          description: "Try clearing the search or status filter.",
          action: hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined,
        }}
        rowActions={rowActions}
        pagination={{
          page,
          pageSize,
          totalCount,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          itemLabel: "trades",
          disabled: isFetching,
          controlsAlign: "center",
        }}
      />

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmDel(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Delete {confirmDel.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the trade. Linked groups and tasks may become unavailable.
            </p>
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
                Delete trade
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
