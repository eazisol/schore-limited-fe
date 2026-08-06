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
  holidaysService,
  type ApiHoliday,
  type HolidayPayload,
} from "@/lib/api/services/holidays";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { activeStatusClass } from "@/lib/module-ui";
import { HOLIDAYS_ROUTE } from "@/lib/holidays";
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  descriptionSchema,
  nameSchema,
} from "@/lib/field-validation";

export const Route = createFileRoute("/holidays")({
  head: () => ({ meta: [{ title: "Holidays | Schore" }] }),
  component: HolidaysPage,
});

export const holidaysQueryKey = ["holidays"] as const;

const schema = z.object({
  name: nameSchema(),
  date: z.string().min(1, "Date is required"),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiHoliday }
  | { kind: "view"; item: ApiHoliday };

function HolidaysPage() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: HOLIDAYS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: HOLIDAYS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiHoliday | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...holidaysQueryKey, { page, pageSize, search }],
    queryFn: async () =>
      (await holidaysService.list({ page, pageSize, search })).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => holidaysService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Holiday deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: holidaysQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete holiday"),
  });

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No holidays to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `holidays-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Date", "Description", "Status"],
        rows: rows.map((item) => [
          item.name,
          item.date?.slice(0, 10) ?? "",
          item.description ?? "",
          item.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(`Exported ${rows.length} holiday${rows.length === 1 ? "" : "s"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiHoliday>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (item) => <span className="font-medium">{item.name}</span>,
      },
      {
        id: "date",
        header: "Date",
        cell: (item) => item.date?.slice(0, 10) || "—",
      },
      {
        id: "description",
        header: "Description",
        cellClassName: "text-muted-foreground",
        cell: (item) => item.description || "—",
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

  const rowActions = useMemo<DataTableRowAction<ApiHoliday>[]>(
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
        title="Holiday calendar"
        subtitle="Excluded automatically from DAYS and KPI working-day counts."
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
            <Can route={HOLIDAYS_ROUTE} action="modify">
              <Button size="sm" onClick={() => setMode({ kind: "create" })}>
                <Plus className="h-4 w-4" />
                Add holiday
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
        loadingText="Loading holidays…"
        error={
          query.isError
            ? {
                title: "Unable to load holidays",
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
          placeholder: "Search holidays…",
          "aria-label": "Search holidays",
        }}
        emptyState={{
          title: "No holidays found.",
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
          itemLabel: "holidays",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {mode && (
        <HolidayFormModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            qc.invalidateQueries({ queryKey: holidaysQueryKey });
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
              Delete holiday “{confirmDel.name}”?
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

function HolidayFormModal({
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
      date: existing?.date?.slice(0, 10) ?? "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: HolidayPayload) => {
      if (mode.kind === "edit") return holidaysService.update(mode.item.id, payload);
      return holidaysService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message || (mode.kind === "edit" ? "Holiday updated" : "Holiday created"));
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save holiday"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      date: values.date,
      description: values.description.trim() || null,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create" ? "Add holiday" : mode.kind === "edit" ? "Edit holiday" : "View holiday";

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
            <TextField<Values> name="name" label="Name" required autoFocus={!isView} maxLength={NAME_MAX_LENGTH} />
            <TextField<Values> name="date" label="Date" type="date" required />
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
                {mode.kind === "edit" ? "Update holiday" : "Create holiday"}
              </SubmitButton>
            )}
          </div>
        </div>
      </Modal>
    </Form>
  );
}
