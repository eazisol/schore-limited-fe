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
  propertiesService,
  type ApiProperty,
  type PropertySortBy,
} from "@/lib/api/services/properties";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { AppTooltip } from "@/components/AppTooltip";
import { activeStatusClass, formatDateTime, truncateWithEllipsis } from "@/lib/module-ui";
import { PROPERTIES_ROUTE } from "@/lib/properties";
import { SearchableSelect } from "@/components/form";
import { fetchCustomerOptions, fetchContractorOptions } from "@/lib/user-dropdowns";

export const Route = createFileRoute("/properties/")({
  head: () => ({ meta: [{ title: "Properties | Schore" }] }),
  component: PropertiesList,
});

export const propertiesQueryKey = ["properties"] as const;

/** Backend-supported column SortBy values (createdDate is default only). */
const COLUMN_SORT_KEYS: Record<string, PropertySortBy> = {
  propertyName: "name",
  contactName: "contactname",
  contractor: "contractor",
};

function PropertiesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: PROPERTIES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: PROPERTIES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<PropertySortBy>("createdDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [contractorId, setContractorId] = useState<number | undefined>(undefined);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [contractorLabel, setContractorLabel] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiProperty | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      ...propertiesQueryKey,
      { page, pageSize, search, sortBy, sortDir, customerId, contractorId },
    ],
    queryFn: async () =>
      (
        await propertiesService.list({
          page,
          pageSize,
          search,
          sortBy,
          sortDir,
          customerId,
          contractorId,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => propertiesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Property deleted");
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: propertiesQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete property"),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  async function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No properties to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `properties-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: [
          "Property Name",
          "Contact Name",
          "Contractor",
          "Phone",
          "Status",
          "Created Date",
        ],
        rows: rows.map((row) => [
          row.propertyName,
          row.contactName,
          row.contractorName ?? "",
          csvForceText(row.contactPhoneNo ?? ""),
          row.isActive ? "Active" : "Inactive",
          formatDateTime(row.createdDate),
        ]),
      });
      toast.success(`Exported ${rows.length} propert${rows.length === 1 ? "y" : "ies"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiProperty>[]>(
    () => [
      {
        id: "propertyName",
        header: "Property Name",
        sortable: true,
        truncate: false,
        cell: (row) => (
          <AppTooltip content={row.propertyName} asChild align="start">
            <Link
              to="/properties/$id"
              params={{ id: String(row.id) }}
              className="inline-block max-w-full font-medium hover:text-info hover:underline"
            >
              {truncateWithEllipsis(row.propertyName)}
            </Link>
          </AppTooltip>
        ),
      },
      {
        id: "contactName",
        header: "Contact Name",
        sortable: true,
        cell: (row) => truncateWithEllipsis(row.contactName),
      },
      {
        id: "contractor",
        header: "Contractor",
        sortable: true,
        cell: (row) => row.contractorName?.trim() || "—",
      },
      {
        id: "phone",
        header: "Phone",
        sortable: false,
        cell: (row) => row.contactPhoneNo?.trim() || "—",
      },
      {
        id: "status",
        header: "Status",
        sortable: false,
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
        cell: (row) => formatDateTime(row.createdDate),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiProperty>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (row) =>
          navigate({ to: "/properties/$id", params: { id: String(row.id) } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (row) =>
          navigate({
            to: "/properties/$id",
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
    setCustomerId(undefined);
    setContractorId(undefined);
    setCustomerLabel(null);
    setContractorLabel(null);
    setPage(1);
  }

  const hasActiveFilters = Boolean(search || customerId != null || contractorId != null);

  return (
    <div>
      <PageHeader
        title="Properties"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExportCsv()}
              disabled={exporting || isLoading}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </Button>
            <Can route={PROPERTIES_ROUTE} action="modify">
              <Button size="sm" asChild>
                <Link to="/properties/new">
                  <Plus className="h-4 w-4" />
                  Add property
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
        loadingText="Loading properties…"
        error={
          isError
            ? {
                title: "Unable to load properties",
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
          placeholder: "Search properties…",
          "aria-label": "Search properties",
        }}
        filters={
          <>
            <SearchableSelect
              value={customerId != null ? String(customerId) : ""}
              onValueChange={(value) => {
                setCustomerId(value ? Number(value) : undefined);
                if (!value) setCustomerLabel(null);
                setPage(1);
              }}
              onSelect={(option) => {
                setCustomerLabel(option.value ? option.label : null);
              }}
              placeholder="All customers"
              searchPlaceholder="Search customers…"
              aria-label="Filter by customer"
              queryKey={["users", "customers", "dropdown"]}
              fetchOptions={fetchCustomerOptions}
              selectedLabel={customerLabel}
              emptyOption={{ value: "", label: "All customers" }}
              className="w-full min-w-[11rem] sm:w-52"
              triggerClassName="h-9 [&>span]:whitespace-nowrap"
            />
            <SearchableSelect
              value={contractorId != null ? String(contractorId) : ""}
              onValueChange={(value) => {
                setContractorId(value ? Number(value) : undefined);
                if (!value) setContractorLabel(null);
                setPage(1);
              }}
              onSelect={(option) => {
                setContractorLabel(option.value ? option.label : null);
              }}
              placeholder="All contractors"
              searchPlaceholder="Search contractors…"
              aria-label="Filter by contractor"
              queryKey={["users", "contractors", "dropdown"]}
              fetchOptions={fetchContractorOptions}
              selectedLabel={contractorLabel}
              emptyOption={{ value: "", label: "All contractors" }}
              className="w-full min-w-[11rem] sm:w-52"
              triggerClassName="h-9 [&>span]:whitespace-nowrap"
            />
          </>
        }
        sort={{
          sortBy: activeSortColumn,
          sortDir,
          onSortChange: handleSortChange,
        }}
        emptyState={{
          title: "No properties match your filters",
          description: "Try clearing the search or filters.",
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
          itemLabel: "properties",
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
            <h3 className="font-display text-lg font-semibold">
              Delete {confirmDel.propertyName}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the property record.
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
                Delete property
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
