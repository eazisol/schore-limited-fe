import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, TextField, TextareaField, SubmitButton, SearchableSelectField } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { taskHoldsService, type ApiTaskHold } from "@/lib/api/services/task-holds";
import { holdReasonsService } from "@/lib/api/services/hold-reasons";
import { tasksService } from "@/lib/api/services/tasks";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { HOLD_ROUTE } from "@/lib/hold";
import { formatDateTime } from "@/lib/module-ui";

export const Route = createFileRoute("/hold")({
  head: () => ({ meta: [{ title: "Hold Management | Schore" }] }),
  component: Hold,
});

export const taskHoldsQueryKey = ["task-holds"] as const;

const schema = z.object({
  taskId: z.string().min(1, "Job is required"),
  holdDate: z.string().min(1, "Date is required"),
  holdReasonId: z.string().min(1, "Reason is required"),
  notes: z.string(),
});
type Values = z.infer<typeof schema>;

function Hold() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: HOLD_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: HOLD_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<ApiTaskHold | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...taskHoldsQueryKey, { page, pageSize, search }],
    queryFn: async () =>
      (await taskHoldsService.list({ page, pageSize, search })).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => taskHoldsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Hold removed");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: taskHoldsQueryKey });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => notifyApiError(err, "Failed to remove hold"),
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const columns: DataTableColumn<ApiTaskHold>[] = [
    {
      id: "task",
      header: "Job",
      cell: (h) => (
        <div>
          <div className="font-medium">{h.taskNumber || `Job #${h.taskId}`}</div>
          <div className="text-xs text-muted-foreground">{h.propertyName || "—"}</div>
        </div>
      ),
    },
    {
      id: "date",
      header: "Hold date",
      cell: (h) => h.holdDate?.slice(0, 10) || "—",
    },
    {
      id: "reason",
      header: "Reason",
      cell: (h) => h.holdReasonName || "—",
    },
    {
      id: "notes",
      header: "Notes",
      cellClassName: "text-muted-foreground",
      cell: (h) => h.notes || "—",
    },
    {
      id: "created",
      header: "Recorded",
      cell: (h) => formatDateTime(h.createdDate),
    },
  ];

  const rowActions: DataTableRowAction<ApiTaskHold>[] = [
    {
      id: "delete",
      label: "Remove",
      icon: <Trash2 className="h-4 w-4" />,
      danger: true,
      hidden: () => !canDelete,
      onClick: (h) => setConfirmDel(h),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Hold / No Count Management"
        subtitle="Per-day holds are excluded from DAYS and KPI. Weekends and holidays are also excluded."
        actions={
          <Can route={HOLD_ROUTE} action="modify">
            <Button size="sm" onClick={() => setOpen((o) => !o)}>
              <Plus className="h-4 w-4" />
              New hold
            </Button>
          </Can>
        }
      />

      {open && canModify && (
        <AddHoldForm
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: taskHoldsQueryKey });
            qc.invalidateQueries({ queryKey: ["tasks"] });
          }}
        />
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(h) => h.id}
        loading={query.isLoading}
        fetching={query.isFetching}
        loadingText="Loading holds…"
        error={
          query.isError
            ? {
                title: "Unable to load holds",
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
          placeholder: "Search holds…",
          "aria-label": "Search holds",
        }}
        emptyState={{
          title: "No hold days recorded.",
          description: search ? "Try clearing the search." : "Add a hold or set a job status to Hold.",
          action: search ? (
            <Button variant="outline" size="sm" onClick={clearSearch}>
              Clear search
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link to="/hold-reasons">Manage reasons</Link>
            </Button>
          ),
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
          itemLabel: "holds",
          disabled: query.isFetching,
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
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Remove this hold day?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {confirmDel.taskNumber} · {confirmDel.holdDate?.slice(0, 10)} will count again in DAYS/KPI.
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
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddHoldForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      taskId: "",
      holdDate: new Date().toISOString().slice(0, 10),
      holdReasonId: "",
      notes: "",
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["lookups", "tasks-for-hold"],
    queryFn: async () =>
      (await tasksService.list({ page: 1, pageSize: 100, sortBy: "createdDate", sortDir: "desc" }))
        .data.items,
  });

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      taskHoldsService.create({
        taskId: values.taskId,
        holdDate: values.holdDate,
        holdReasonId: values.holdReasonId,
        notes: values.notes.trim() || null,
      }),
    onSuccess: (res) => {
      toast.success(res.message || "Hold added");
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to add hold"),
  });

  return (
    <Form
      form={form}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      className="card-elevated mb-6 space-y-4 p-6"
    >
      <h2 className="font-semibold">Add hold day</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Job <span className="text-destructive">*</span>
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.watch("taskId")}
            onChange={(e) => form.setValue("taskId", e.target.value, { shouldValidate: true })}
          >
            <option value="">Select job…</option>
            {(tasksQuery.data ?? []).map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.taskNumber} · {t.propertyName}
              </option>
            ))}
          </select>
        </div>
        <TextField<Values> name="holdDate" label="Date" type="date" required />
        <SearchableSelectField<Values>
          name="holdReasonId"
          label="Hold reason"
          required
          placeholder="Select reason…"
          searchPlaceholder="Search reasons…"
          queryKey={["lookups", "hold-reasons", "hold-page"]}
          fetchOptions={async (search) => {
            const res = await holdReasonsService.list({
              page: 1,
              pageSize: 50,
              search: search.trim(),
            });
            return (res.data.items ?? [])
              .filter((r) => r.isActive)
              .map((r) => ({ value: String(r.id), label: r.name }));
          }}
          className="md:col-span-2"
        />
        <TextareaField<Values> name="notes" label="Notes" rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <SubmitButton loading={mutation.isPending} loadingText="Saving…">
          Add hold
        </SubmitButton>
      </div>
    </Form>
  );
}
