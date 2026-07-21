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
import { cisService, type ApiCisStatus, type CisSortBy } from "@/lib/api/services/cis";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppTooltip } from "@/components/AppTooltip";
import { activeStatusClass, formatCisRate } from "@/lib/module-ui";

const CIS_ROUTE = "/cis-management";

export const Route = createFileRoute("/cis-management/")({
  head: () => ({ meta: [{ title: "CIS Management | Schore" }] }),
  component: CisList,
});

export const cisQueryKey = ["cis"] as const;

const COLUMN_SORT_KEYS: Record<string, CisSortBy> = {
  name: "name",
  code: "code",
  rate: "rate",
  status: "status",
};

function CisList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: CIS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: CIS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<"active" | "inactive" | undefined>(undefined);
  const [sortBy, setSortBy] = useState<CisSortBy>("rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [confirmDel, setConfirmDel] = useState<ApiCisStatus | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...cisQueryKey, { page, pageSize, search, status, sortBy, sortDir }],
    queryFn: async () =>
      (await cisService.list({ page, pageSize, search, status, sortBy, sortDir })).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cisService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "CIS status deleted");
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: cisQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete CIS status"),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No CIS statuses to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `cis-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Code", "Name", "Rate", "Default", "Status"],
        rows: rows.map((c) => [
          c.code,
          c.name,
          formatCisRate(c.rate),
          c.isDefault ? "Yes" : "No",
          c.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(`Exported ${rows.length} CIS status${rows.length === 1 ? "" : "es"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiCisStatus>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <AppTooltip content={row.name} asChild>
              <Link
                to="/cis-management/$id"
                params={{ id: String(row.id) }}
                className="block truncate font-medium hover:text-info hover:underline"
              >
                {row.name}
              </Link>
            </AppTooltip>
            {row.description ? (
              <div className="truncate text-[11px] text-muted-foreground">{row.description}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "code",
        header: "Code",
        sortable: true,
        cell: (row) => (
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">{row.code}</code>
        ),
      },
      {
        id: "rate",
        header: "Rate",
        sortable: true,
        cell: (row) => (
          <span className="font-mono tabular-nums">{formatCisRate(row.rate)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (row) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(row.isActive)}`}
            >
              {row.isActive ? "Active" : "Inactive"}
            </span>
            {row.isDefault ? (
              <span className="inline-flex items-center rounded-full border border-info/20 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
                Default
              </span>
            ) : null}
          </div>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiCisStatus>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (row) =>
          navigate({ to: "/cis-management/$id", params: { id: String(row.id) } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (row) =>
          navigate({
            to: "/cis-management/$id",
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
    Object.entries(COLUMN_SORT_KEYS).find(([, apiKey]) => apiKey === sortBy)?.[0] ?? "rate";

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
        title="CIS Management"
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
            <Can route={CIS_ROUTE} action="modify">
              <Button size="sm" asChild>
                <Link to="/cis-management/new">
                  <Plus className="h-4 w-4" />
                  Add CIS status
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={isLoading}
        fetching={isFetching}
        loadingText="Loading CIS statuses…"
        error={
          isError
            ? {
                title: "Unable to load CIS statuses",
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
          placeholder: "Search by name, code or rate…",
          "aria-label": "Search CIS statuses",
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
          title: "No CIS statuses match your filters",
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
          itemLabel: "statuses",
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
              This permanently removes the CIS status. Operatives using it may need reassignment.
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
                Delete CIS status
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
