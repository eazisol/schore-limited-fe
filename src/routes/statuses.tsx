import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Download, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import {
  Form,
  TextField,
  TextareaField,
  SwitchField,
  SubmitButton,
  SearchableSelectField,
} from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  downloadCsv,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import {
  statusesService,
  type ApiStatus,
  type StatusPayload,
} from "@/lib/api/services/statuses";
import { fetchDocumentTypeOptions } from "@/lib/api/services/document-types";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { activeStatusClass } from "@/lib/module-ui";
import { STATUSES_ROUTE } from "@/lib/statuses";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
  normalizeCodeInput,
  orderBySchema,
} from "@/lib/field-validation";

export const Route = createFileRoute("/statuses")({
  head: () => ({ meta: [{ title: "Statuses | Schore" }] }),
  component: StatusesPage,
});

export const statusesQueryKey = ["statuses"] as const;
const lookupsKey = ["lookups", "statuses"] as const;

const schema = z.object({
  name: nameSchema(),
  code: codeSchema(),
  documentTypeId: z.string().trim().min(1, "Document type is required"),
  description: descriptionSchema(),
  orderBy: orderBySchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiStatus }
  | { kind: "view"; item: ApiStatus };

function StatusesPage() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: STATUSES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: STATUSES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [documentTypeFilter, setDocumentTypeFilter] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiStatus | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [
      ...statusesQueryKey,
      { page, pageSize, search, documentTypeId: documentTypeFilter || undefined },
    ],
    queryFn: async () =>
      (
        await statusesService.list({
          page,
          pageSize,
          search,
          ...(documentTypeFilter ? { documentTypeId: Number(documentTypeFilter) } : {}),
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => statusesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Status deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: statusesQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete status"),
  });

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No statuses to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `statuses-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Code", "Document Type", "Order", "Status"],
        rows: rows.map((item) => [
          item.name,
          item.code,
          item.documentTypeName ?? "",
          String(item.orderBy),
          item.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(`Exported ${rows.length} status${rows.length === 1 ? "" : "es"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiStatus>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessor: (item) => item.name,
        cell: (item) => <span className="font-medium">{item.name}</span>,
      },
      {
        id: "code",
        header: "Code",
        cell: (item) => (
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">{item.code}</code>
        ),
      },
      {
        id: "documentType",
        header: "Document type",
        accessor: (item) => item.documentTypeName || "—",
        cell: (item) => item.documentTypeName || "—",
      },
      {
        id: "orderBy",
        header: "Order",
        accessor: (item) => String(item.orderBy),
        cellClassName: "text-muted-foreground",
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

  const rowActions = useMemo<DataTableRowAction<ApiStatus>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (item) => setMode({ kind: "view", item }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (item) => setMode({ kind: "edit", item }),
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
    [canDelete, canModify],
  );

  return (
    <div>
      <PageHeader
        title="Statuses"
        actions={
          <>
            <DocumentTypeFilter
              value={documentTypeFilter}
              onChange={(value) => {
                setDocumentTypeFilter(value);
                setPage(1);
              }}
            />
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
            <Can route={STATUSES_ROUTE} action="modify">
              <Button size="sm" onClick={() => setMode({ kind: "create" })}>
                <Plus className="h-4 w-4" />
                Add status
              </Button>
            </Can>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(item) => item.id}
        loading={query.isLoading}
        fetching={query.isFetching}
        loadingText="Loading statuses…"
        error={
          query.isError
            ? {
                title: "Unable to load statuses",
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
          placeholder: "Search by name or code…",
          "aria-label": "Search statuses",
        }}
        emptyState={{
          title: "No statuses found.",
          description: search || documentTypeFilter ? "Try clearing filters." : undefined,
          action:
            search || documentTypeFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearSearch();
                  setDocumentTypeFilter("");
                  setPage(1);
                }}
              >
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
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {mode && (
        <StatusFormModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            qc.invalidateQueries({ queryKey: statusesQueryKey });
            qc.invalidateQueries({ queryKey: lookupsKey });
          }}
        />
      )}

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
              Delete status “{confirmDel.name}”?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">This action cannot be undone.</p>
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
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentTypeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const query = useQuery({
    queryKey: ["lookups", "document-types", "filter"],
    queryFn: async () => (await fetchDocumentTypeOptions("")).map((opt) => ({
      value: opt.value,
      label: opt.label,
    })),
  });

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      aria-label="Filter by document type"
    >
      <option value="">All document types</option>
      {(query.data ?? []).map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function StatusFormModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isView = mode.kind === "view";
  const existing = mode.kind === "create" ? null : mode.item;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: existing?.name ?? "",
      code: existing?.code ?? "",
      documentTypeId: existing?.documentTypeId ? String(existing.documentTypeId) : "",
      description: existing?.description ?? "",
      orderBy: existing?.orderBy ?? 0,
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: StatusPayload) => {
      if (mode.kind === "edit") return statusesService.update(mode.item.id, payload);
      return statusesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message || (mode.kind === "edit" ? "Status updated" : "Status created"));
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save status"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      documentTypeId: Number(values.documentTypeId),
      description: values.description.trim() || null,
      orderBy: values.orderBy,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create"
      ? "Add status"
      : mode.kind === "edit"
        ? "Edit status"
        : "View status";

  return (
    <Form form={form} onSubmit={submit} className="contents">
      <Modal
        open
        onClose={onClose}
        title={title}
        size="md"
        showCloseButton={false}
        headerActions={<SwitchField<Values> name="isActive" label="Active" disabled={isView} />}
      >
        <div className="space-y-4">
          <fieldset disabled={isView} className="space-y-4">
            <SearchableSelectField<Values>
              name="documentTypeId"
              label="Document type"
              required
              placeholder="Select document type…"
              searchPlaceholder="Search document types…"
              queryKey={["lookups", "document-types", "form"]}
              fetchOptions={fetchDocumentTypeOptions}
              selectedLabel={existing?.documentTypeName}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField<Values>
                name="name"
                label="Name"
                required
                autoFocus={!isView}
                maxLength={NAME_MAX_LENGTH}
              />
              <TextField<Values>
                name="code"
                label="Code"
                required
                maxLength={CODE_MAX_LENGTH}
                transformValue={normalizeCodeInput}
                inputClassName="uppercase"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField<Values>
                name="orderBy"
                label="Order"
                type="number"
                min={0}
                step={1}
                required
              />
            </div>
            <TextareaField<Values>
              name="description"
              label="Description"
              rows={3}
              maxLength={DESCRIPTION_MAX_LENGTH}
            />
          </fieldset>
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {isView ? "Close" : "Cancel"}
            </Button>
            {!isView && (
              <SubmitButton size="sm" loadingText="Saving…">
                {mode.kind === "edit" ? "Update status" : "Create status"}
              </SubmitButton>
            )}
          </div>
        </div>
      </Modal>
    </Form>
  );
}
