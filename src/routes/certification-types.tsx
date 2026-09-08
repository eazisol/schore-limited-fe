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
import { Form, TextField, TextareaField, SwitchField, SubmitButton } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  downloadCsv,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import {
  certificationTypesService,
  type ApiCertificationType,
  type CertificationTypePayload,
} from "@/lib/api/services/certification-types";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { CERTIFICATION_TYPES_ROUTE } from "@/lib/certification-types";
import {
  DESCRIPTION_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
  normalizeCodeInput,
} from "@/lib/field-validation";

export const Route = createFileRoute("/certification-types")({
  head: () => ({ meta: [{ title: "Certification Types | Schore" }] }),
  component: CertificationTypesPage,
});

export const certificationTypesQueryKey = ["certification-types"] as const;
const lookupsKey = ["lookups", "certification-types"] as const;

const schema = z.object({
  name: nameSchema("Name", 100),
  code: codeSchema("Code", 50),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiCertificationType }
  | { kind: "view"; item: ApiCertificationType };

function CertificationTypesPage() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: CERTIFICATION_TYPES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: CERTIFICATION_TYPES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiCertificationType | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...certificationTypesQueryKey, { page, pageSize, search }],
    queryFn: async () =>
      (await certificationTypesService.list({ page, pageSize, search })).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => certificationTypesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Certification type deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: certificationTypesQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete certification type"),
  });

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No certification types to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `certification-types-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Code", "Description", "Status"],
        rows: rows.map((item) => [
          item.name,
          item.code,
          item.description ?? "",
          item.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(
        `Exported ${rows.length} certification type${rows.length === 1 ? "" : "s"} to CSV`,
      );
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiCertificationType>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessor: (item) => item.name,
        cell: (item) => (
          <button
            type="button"
            className="font-medium text-left hover:text-info hover:underline"
            onClick={() => setMode({ kind: "view", item })}
          >
            {item.name}
          </button>
        ),
      },
      {
        id: "code",
        header: "Code",
        accessor: (item) => item.code,
      },
      {
        id: "status",
        header: "Status",
        cell: (item) => <ActiveStatusBadge isActive={item.isActive} />,
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiCertificationType>[]>(
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
        title="Certification types"
        subtitle="Lookup types used on operative accreditation records."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || query.isLoading}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </Button>
            <Can route={CERTIFICATION_TYPES_ROUTE} action="modify">
              <Button size="sm" onClick={() => setMode({ kind: "create" })}>
                <Plus className="h-4 w-4" />
                Add type
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
        loadingText="Loading certification types…"
        error={
          query.isError
            ? {
                title: "Unable to load certification types",
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
          placeholder: "Search types…",
          "aria-label": "Search certification types",
        }}
        emptyState={{
          title: "No certification types found.",
          description: search ? "Try clearing the search." : undefined,
          action: search ? (
            <Button variant="outline" size="sm" onClick={clearSearch}>
              Clear search
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
          itemLabel: "types",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {mode && (
        <CertificationTypeFormModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            qc.invalidateQueries({ queryKey: certificationTypesQueryKey });
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
              Delete certification type “{confirmDel.name}”?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDel(null)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDel.id)}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CertificationTypeFormModal({
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
    defaultValues: {
      name: existing?.name ?? "",
      code: existing?.code ?? "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: CertificationTypePayload) => {
      if (mode.kind === "edit") return certificationTypesService.update(mode.item.id, payload);
      return certificationTypesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message || (mode.kind === "edit" ? "Certification type updated" : "Certification type created"),
      );
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save certification type"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      description: values.description.trim() || null,
      orderBy: existing?.orderBy ?? 0,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create"
      ? "Add certification type"
      : mode.kind === "edit"
        ? "Edit certification type"
        : "View certification type";

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
        <div className="space-y-3">
          <fieldset disabled={isView} className="space-y-3">
            <TextField<Values> name="name" label="Name" required autoFocus={!isView} maxLength={100} />
            <TextField<Values>
              name="code"
              label="Code"
              required
              maxLength={50}
              transformValue={normalizeCodeInput}
            />
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
                {mode.kind === "edit" ? "Update type" : "Create type"}
              </SubmitButton>
            )}
          </div>
        </div>
      </Modal>
    </Form>
  );
}
