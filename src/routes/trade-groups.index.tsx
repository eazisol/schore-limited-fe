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
import {
  tradeGroupsService,
  type ApiTradeGroup,
  type TradeGroupSortBy,
} from "@/lib/api/services/trade-groups";
import { tradesService } from "@/lib/api/services/trades";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { AppTooltip } from "@/components/AppTooltip";
import { activeStatusClass, formatDateTime, truncateWithEllipsis } from "@/lib/module-ui";
import { TRADE_GROUPS_ROUTE } from "@/lib/trade-groups";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/trade-groups/")({
  head: () => ({ meta: [{ title: "Trade Groups | Schore" }] }),
  component: TradeGroupsList,
});

export const tradeGroupsQueryKey = ["trade-groups"] as const;

/** Backend-supported column SortBy values (createdDate is default only). */
const COLUMN_SORT_KEYS: Record<string, TradeGroupSortBy> = {
  name: "name",
  code: "code",
  trade: "trade",
  status: "status",
};

function TradeGroupsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: TRADE_GROUPS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: TRADE_GROUPS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<TradeGroupSortBy>("createdDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tradeId, setTradeId] = useState<number | undefined>(undefined);
  const [confirmDel, setConfirmDel] = useState<ApiTradeGroup | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const tradesQuery = useQuery({
    queryKey: ["trades", "options", "filter"],
    queryFn: async () => (await tradesService.options()).data ?? [],
    staleTime: 60_000,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...tradeGroupsQueryKey, { page, pageSize, search, sortBy, sortDir, tradeId }],
    queryFn: async () =>
      (
        await tradeGroupsService.list({
          page,
          pageSize,
          search,
          sortBy,
          sortDir,
          tradeId,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tradeGroupsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Trade group deleted");
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: tradeGroupsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete trade group"),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const trades = tradesQuery.data ?? [];

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No trade groups to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `trade-groups-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Code", "Trade", "Status", "Created Date"],
        rows: rows.map((row) => [
          row.name,
          row.code,
          row.tradeName ?? "",
          row.isActive ? "Active" : "Inactive",
          formatDateTime(row.createdDate),
        ]),
      });
      toast.success(`Exported ${rows.length} trade group${rows.length === 1 ? "" : "s"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiTradeGroup>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        truncate: false,
        width: "22%",
        cell: (row) => (
          <AppTooltip content={row.name} asChild align="start">
            <Link
              to="/trade-groups/$id"
              params={{ id: String(row.id) }}
              className="inline-block max-w-full font-medium hover:text-info hover:underline"
            >
              {truncateWithEllipsis(row.name)}
            </Link>
          </AppTooltip>
        ),
      },
      {
        id: "code",
        header: "Code",
        sortable: true,
        width: "11%",
        cell: (row) => (
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">{row.code}</code>
        ),
      },
      {
        id: "trade",
        header: "Trade",
        sortable: true,
        width: "22%",
        cell: (row) => row.tradeName?.trim() || "—",
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        width: "13%",
        cell: (row) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(row.isActive)}`}
          >
            {row.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        id: "createdDate",
        header: "Created Date",
        sortable: false,
        width: "14%",
        truncate: false,
        cell: (row) => (
          <span className="whitespace-nowrap">{formatDateTime(row.createdDate)}</span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiTradeGroup>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (row) =>
          navigate({ to: "/trade-groups/$id", params: { id: String(row.id) } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (row) =>
          navigate({
            to: "/trade-groups/$id",
            params: { id: String(row.id) },
            search: { mode: "edit" },
          }),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (row) => setConfirmDel(row),
      },
    ],
    [canDelete, canModify, navigate],
  );

  const activeSortColumn =
    Object.entries(COLUMN_SORT_KEYS).find(([, apiKey]) => apiKey === sortBy)?.[0] ?? "";

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

  const hasActiveFilters = Boolean(search || tradeId != null);

  return (
    <div>
      <PageHeader
        title="Trade Groups"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || isLoading}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </Button>
            <Can route={TRADE_GROUPS_ROUTE} action="modify">
              <Button size="sm" asChild>
                <Link to="/trade-groups/new">
                  <Plus className="h-4 w-4" />
                  Add trade group
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={isLoading}
        fetching={isFetching}
        loadingText="Loading trade groups…"
        error={
          isError
            ? {
                title: "Unable to load trade groups",
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
          placeholder: "Search trade groups…",
          "aria-label": "Search trade groups",
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
              className="h-9 w-full min-w-[11rem] sm:w-52 [&>span]:whitespace-nowrap"
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
          title: "No trade groups match your filters",
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
          itemLabel: "trade groups",
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
              This permanently removes the trade group and its items.
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
                Delete trade group
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
