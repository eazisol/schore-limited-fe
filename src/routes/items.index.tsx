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
import {
  productsService,
  resolveProductImageUrl,
  type ApiProduct,
  type ProductsSortBy,
} from "@/lib/api/services/products";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { AppTooltip } from "@/components/AppTooltip";
import { TableImagePreview } from "@/components/TableImagePreview";
import { activeStatusClass, formatGbp } from "@/lib/module-ui";
import { ITEMS_ROUTE } from "@/lib/items";

export const Route = createFileRoute("/items/")({
  head: () => ({ meta: [{ title: "Items | Schore" }] }),
  component: ItemsList,
});

export const itemsQueryKey = ["items"] as const;

const ITEM_COLUMN_SORT_KEYS: Record<string, ProductsSortBy> = {
  name: "name",
  sku: "sku",
  category: "category",
  salePrice: "saleprice",
  status: "status",
};

function ItemsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: ITEMS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: ITEMS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<ProductsSortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [confirmDel, setConfirmDel] = useState<ApiProduct | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...itemsQueryKey, { page, pageSize, search, sortBy, sortDir }],
    queryFn: async () =>
      (await productsService.list({ page, pageSize, search, sortBy, sortDir })).data,
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
        sortable: true,
        truncate: false,
        cell: (item) => {
          const src = resolveProductImageUrl(item.imageUrl, item.editDate);
          return (
            <div className="flex min-w-0 items-center gap-3">
              <TableImagePreview
                src={src}
                alt={item.name}
                className="h-9 w-9"
                fallback={
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-muted/40 text-muted-foreground">
                    <Package className="h-4 w-4" />
                  </div>
                }
              />
              <div className="min-w-0">
                <AppTooltip content={item.name} asChild>
                  <Link
                    to="/items/$id"
                    params={{ id: String(item.id) }}
                    className="line-clamp-2 break-words font-medium hover:text-info hover:underline"
                  >
                    {item.name}
                  </Link>
                </AppTooltip>
              </div>
            </div>
          );
        },
      },
      {
        id: "sku",
        header: "SKU",
        sortable: true,
        cell: (item) => (
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">{item.sku}</code>
        ),
      },
      {
        id: "category",
        header: "Category",
        sortable: true,
        cell: (item) => item.categoryName || "—",
      },
      {
        id: "salePrice",
        header: "Sale price",
        sortable: true,
        cell: (item) => (
          <span className="font-mono tabular-nums">{formatGbp(item.salePrice)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (item) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(item.isActive)}`}
          >
            {item.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        id: "image",
        header: "Image",
        align: "center",
        width: "5rem",
        truncate: false,
        cell: (item) => (
          <TableImagePreview
            src={resolveProductImageUrl(item.imageUrl, item.editDate)}
            alt={item.name}
            variant="icon"
            tooltip={item.imageUrl ? "View image" : "No image"}
          />
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

  const activeSortColumn =
    Object.entries(ITEM_COLUMN_SORT_KEYS).find(([, apiKey]) => apiKey === sortBy)?.[0] ?? "name";

  function handleSortChange(columnId: string, direction: "asc" | "desc") {
    const apiSortBy = ITEM_COLUMN_SORT_KEYS[columnId];
    if (!apiSortBy) return;
    setSortBy(apiSortBy);
    setSortDir(direction);
    setPage(1);
  }

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
        sort={{
          sortBy: activeSortColumn,
          sortDir,
          onSortChange: handleSortChange,
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
