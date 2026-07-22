import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  downloadCsv,
  csvForceText,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { Plus, Eye, Pencil, Trash2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  operativesService,
  type ApiOperative,
  type OperativesSortBy,
} from "@/lib/api/services/operatives";
import { tradesService } from "@/lib/api/services/trades";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppTooltip } from "@/components/AppTooltip";
import { activeStatusClass, formatCisRate, formatGbp } from "@/lib/module-ui";

const OPERATIVES_ROUTE = "/operatives";

export const Route = createFileRoute("/operatives/")({
  head: () => ({ meta: [{ title: "Operatives | Schore" }] }),
  component: OperativesList,
});

export const operativesQueryKey = ["operatives"] as const;

const COLUMN_SORT_KEYS: Record<string, OperativesSortBy> = {
  name: "name",
  trade: "trade",
  cis: "cis",
  dailyRate: "dailyRate",
  status: "status",
};

function OperativesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: OPERATIVES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: OPERATIVES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tradeId, setTradeId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<OperativesSortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [confirmDel, setConfirmDel] = useState<ApiOperative | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const tradesQuery = useQuery({
    queryKey: ["trades", "options"],
    queryFn: async () => (await tradesService.options()).data,
    staleTime: 60_000,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...operativesQueryKey, { page, pageSize, search, tradeId, sortBy, sortDir }],
    queryFn: async () =>
      (
        await operativesService.list({
          page,
          pageSize,
          search,
          tradeId,
          sortBy,
          sortDir,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => operativesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Operative deleted");
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: operativesQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete operative"),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const trades = tradesQuery.data ?? [];

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No operatives to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `operatives-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Trade", "CIS", "Daily rate", "Phone", "UTR", "Status"],
        rows: rows.map((o) => [
          o.name,
          o.tradeName,
          formatCisRate(o.cisRate),
          String(o.dailyRate),
          csvForceText(o.phone ?? ""),
          csvForceText(o.utr ?? ""),
          o.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(`Exported ${rows.length} operative${rows.length === 1 ? "" : "s"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiOperative>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        truncate: false,
        cell: (op) => (
          <div className="min-w-0">
            <AppTooltip content={op.name} asChild>
              <Link
                to="/operatives/$id"
                params={{ id: String(op.id) }}
                className="line-clamp-2 break-words font-medium hover:text-info hover:underline"
              >
                {op.name}
              </Link>
            </AppTooltip>
            {op.startDate ? (
              <div className="line-clamp-1 break-words text-[11px] text-muted-foreground">
                Joined {op.startDate}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "trade",
        header: "Trade",
        sortable: true,
        cell: (op) => op.tradeName,
      },
      {
        id: "cis",
        header: "CIS",
        sortable: true,
        cell: (op) => (
          <code className="text-xs font-mono">{formatCisRate(op.cisRate)}</code>
        ),
      },
      {
        id: "dailyRate",
        header: "Daily rate",
        sortable: true,
        cell: (op) => (
          <span className="font-mono tabular-nums">{formatGbp(op.dailyRate)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (op) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(op.isActive)}`}
          >
            {op.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiOperative>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (op) => navigate({ to: "/operatives/$id", params: { id: String(op.id) } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (op) =>
          navigate({
            to: "/operatives/$id",
            params: { id: String(op.id) },
            search: { mode: "edit" },
          }),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (op) => setConfirmDel(op),
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
    setTradeId(undefined);
    setPage(1);
  }

  const hasActiveFilters = Boolean(search) || tradeId != null;

  return (
    <div>
      <PageHeader
        title="Operatives"
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
            <Can route={OPERATIVES_ROUTE} action="modify">
              <Button size="sm" asChild>
                <Link to="/operatives/new">
                  <Plus className="h-4 w-4" />
                  Add operative
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(op) => op.id}
        loading={isLoading}
        fetching={isFetching}
        loadingText="Loading operatives…"
        error={
          isError
            ? {
                title: "Unable to load operatives",
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
          placeholder: "Search by name, trade, phone or UTR…",
          "aria-label": "Search operatives",
        }}
        filters={
          <Select
            value={tradeId != null ? String(tradeId) : "all"}
            onValueChange={(value) => {
              setTradeId(value === "all" ? undefined : Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger
              className="h-9 w-full min-w-[11rem] sm:w-60 [&>span]:whitespace-nowrap"
              aria-label="Filter by trade"
            >
              <SelectValue placeholder="All trades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trades</SelectItem>
              {trades.map((trade) => (
                <SelectItem key={trade.id} value={String(trade.id)}>
                  {trade.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        sort={{
          sortBy: activeSortColumn,
          sortDir,
          onSortChange: handleSortChange,
        }}
        emptyState={{
          title: "No operatives match your filters",
          description: "Try clearing the search or trade filter.",
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
          itemLabel: "operatives",
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
              This removes the operative from the workforce builder. Past wage sheets are kept for
              audit.
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
                Delete operative
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
