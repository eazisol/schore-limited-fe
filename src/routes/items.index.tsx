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
import { Plus, Eye, Pencil, Trash2, Loader2, Download, Package } from "lucide-react";
import { toast } from "sonner";
import { productsService, resolveProductImageUrl, type ApiProduct } from "@/lib/api/services/products";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { AppTooltip } from "@/components/AppTooltip";
import { activeStatusClass, formatGbp } from "@/lib/module-ui";
import { ITEMS_ROUTE } from "@/lib/items";

export const Route = createFileRoute("/items/")({
  head: () => ({ meta: [{ title: "Items | Schore" }] }),
  component: ItemsList,
});

export const itemsQueryKey = ["items"] as const;

function ItemsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: ITEMS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: ITEMS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDel, setConfirmDel] = useState<ApiProduct | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...itemsQueryKey, { page, pageSize, search }],
    queryFn: async () =>
      (await productsService.list({ page, pageSize, search })).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Item deleted");
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: itemsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete item"),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No items to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `items-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["SKU", "Name", "Type", "Category", "Unit", "Sale price", "Status"],
        rows: rows.map((item) => [
          item.sku,
          item.name,
          item.productTypeName ?? "",
          item.categoryName ?? "",
          item.unitName ?? "",
          String(item.salePrice),
          item.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(`Exported ${rows.length} item${rows.length === 1 ? "" : "s"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiProduct>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (item) => {
          const src = resolveProductImageUrl(item.imageUrl, item.editDate);
          return (
            <div className="flex items-center gap-3">
              {src ? (
                <img
                  src={src}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-muted/40 text-muted-foreground">
                  <Package className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                <AppTooltip content={item.name} asChild>
                  <Link
                    to="/items/$id"
                    params={{ id: String(item.id) }}
                    className="block truncate font-medium hover:text-info hover:underline"
                  >
                    {item.name}
                  </Link>
                </AppTooltip>
                {item.description ? (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {item.description}
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "sku",
        header: "SKU",
        cell: (item) => (
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">{item.sku}</code>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: (item) => item.categoryName || "—",
      },
      {
        id: "salePrice",
        header: "Sale price",
        cell: (item) => (
          <span className="font-mono tabular-nums">{formatGbp(item.salePrice)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (item) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(item.isActive)}`}
          >
            {item.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiProduct>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (item) => navigate({ to: "/items/$id", params: { id: String(item.id) } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (item) =>
          navigate({ to: "/items/$id/edit", params: { id: String(item.id) } }),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (item) => setConfirmDel(item),
      },
    ],
    [canDelete, canModify, navigate],
  );

  function clearFilters() {
    clearSearch();
    setPage(1);
  }

  const hasActiveFilters = Boolean(search);

  return (
    <div>
      <PageHeader
        title="Items"
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
            <Can route={ITEMS_ROUTE} action="modify">
              <Button size="sm" asChild>
                <Link to="/items/new">
                  <Plus className="h-4 w-4" />
                  Add item
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(item) => item.id}
        loading={isLoading}
        fetching={isFetching}
        loadingText="Loading items…"
        error={
          isError
            ? {
                title: "Unable to load items",
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
          placeholder: "Search by name, SKU or description…",
          "aria-label": "Search items",
        }}
        emptyState={{
          title: "No items match your filters",
          description: "Try clearing the search.",
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
          itemLabel: "items",
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
              This permanently removes the item from the catalogue. This action cannot be undone.
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
                Delete item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
