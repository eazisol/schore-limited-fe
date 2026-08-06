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
  daySuggestionsService,
  type ApiDaySuggestion,
  type DaySuggestionPayload,
} from "@/lib/api/services/day-suggestions";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { activeStatusClass } from "@/lib/module-ui";
import { DAY_SUGGESTIONS_ROUTE } from "@/lib/day-suggestions";
import {
  DESCRIPTION_MAX_LENGTH,
  descriptionSchema,
} from "@/lib/field-validation";

export const Route = createFileRoute("/day-suggestions")({
  head: () => ({ meta: [{ title: "Day Suggestions | Schore" }] }),
  component: DaySuggestionsPage,
});

export const daySuggestionsQueryKey = ["day-suggestions"] as const;

function splitSuggestedCodes(codes: string): string[] {
  return codes
    .split(/[,/]/)
    .map((code) => code.trim())
    .filter(Boolean);
}

const schema = z.object({
  dayNumber: z.coerce
    .number({ invalid_type_error: "Day number must be a number" })
    .int("Day number must be a whole number")
    .min(1, "Day number must be 1 or greater"),
  codes: z
    .string()
    .trim()
    .min(1, "Codes are required")
    .max(200, "Codes must be 200 characters or fewer"),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiDaySuggestion }
  | { kind: "view"; item: ApiDaySuggestion };

function DaySuggestionsPage() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: DAY_SUGGESTIONS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: DAY_SUGGESTIONS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiDaySuggestion | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...daySuggestionsQueryKey, { page, pageSize, search }],
    queryFn: async () =>
      (await daySuggestionsService.list({ page, pageSize, search })).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => daySuggestionsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Day suggestion deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: daySuggestionsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete day suggestion"),
  });

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No day suggestions to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `day-suggestions-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Day", "Codes", "Description", "Status"],
        rows: rows.map((item) => [
          String(item.dayNumber),
          item.codes,
          item.description ?? "",
          item.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(
        `Exported ${rows.length} day suggestion${rows.length === 1 ? "" : "s"} to CSV`,
      );
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiDaySuggestion>[]>(
    () => [
      {
        id: "dayNumber",
        header: "Day",
        accessor: (item) => `Day ${item.dayNumber}`,
        cell: (item) => (
          <button
            type="button"
            className="font-medium text-left hover:text-info hover:underline"
            onClick={() => setMode({ kind: "view", item })}
          >
            Day {item.dayNumber}
          </button>
        ),
      },
      {
        id: "codes",
        header: "Suggested codes",
        cell: (item) => {
          const codes = splitSuggestedCodes(item.codes);
          if (codes.length === 0) return "—";
          return (
            <div className="flex flex-wrap gap-1">
              {codes.map((code) => (
                <code
                  key={code}
                  className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono"
                >
                  {code}
                </code>
              ))}
            </div>
          );
        },
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

  const rowActions = useMemo<DataTableRowAction<ApiDaySuggestion>[]>(
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
        title="Day suggestions"
        subtitle="Editable per-day trade codes shown as suggestions in the Daily Programme Next Day column. Suggestions never auto-allocate work."
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
            <Can route={DAY_SUGGESTIONS_ROUTE} action="modify">
              <Button size="sm" onClick={() => setMode({ kind: "create" })}>
                <Plus className="h-4 w-4" />
                Add day
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
        loadingText="Loading day suggestions…"
        error={
          query.isError
            ? {
                title: "Unable to load day suggestions",
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
          placeholder: "Search by day or codes…",
          "aria-label": "Search day suggestions",
        }}
        emptyState={{
          title: "No day suggestions found.",
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
          itemLabel: "suggestions",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {mode && (
        <DaySuggestionFormModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            qc.invalidateQueries({ queryKey: daySuggestionsQueryKey });
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
              Delete Day {confirmDel.dayNumber} suggestion?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Codes “{confirmDel.codes}” will no longer appear in Next Day. This action cannot be
              undone.
            </p>
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

function DaySuggestionFormModal({
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
      dayNumber: existing?.dayNumber ?? 1,
      codes: existing?.codes ?? "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: DaySuggestionPayload) => {
      if (mode.kind === "edit") return daySuggestionsService.update(mode.item.id, payload);
      return daySuggestionsService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message || (mode.kind === "edit" ? "Day suggestion updated" : "Day suggestion created"),
      );
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save day suggestion"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      dayNumber: values.dayNumber,
      codes: values.codes.trim(),
      description: values.description.trim() || null,
      // Backend defaults OrderBy to DayNumber when 0; keep field out of the UI.
      orderBy: 0,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create"
      ? "Add day suggestion"
      : mode.kind === "edit"
        ? "Edit day suggestion"
        : "View day suggestion";

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField<Values>
                name="dayNumber"
                label="Day number"
                type="number"
                min={1}
                step={1}
                required
                autoFocus={!isView}
              />
              <TextField<Values>
                name="codes"
                label="Suggested codes"
                placeholder="e.g. L, Pl or ASB/Pl/E"
                required
                maxLength={200}
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
                {mode.kind === "edit" ? "Update suggestion" : "Create suggestion"}
              </SubmitButton>
            )}
          </div>
        </div>
      </Modal>
    </Form>
  );
}
