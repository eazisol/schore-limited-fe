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
  categoriesService,
  type ApiCategory,
  type CategoryPayload,
} from "@/lib/api/services/units-categories";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { activeStatusClass } from "@/lib/module-ui";
import { CATEGORIES_ROUTE } from "@/lib/categories";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
  normalizeCodeInput,
} from "@/lib/field-validation";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories | Schore" }] }),
  component: CategoriesPage,
});

export const categoriesQueryKey = ["categories"] as const;
const lookupsKey = ["lookups", "categories"] as const;

const schema = z.object({
  name: nameSchema(),
  code: codeSchema(),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiCategory }
  | { kind: "view"; item: ApiCategory };

function CategoriesPage() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: CATEGORIES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: CATEGORIES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiCategory | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...categoriesQueryKey, { page, pageSize, search }],
    queryFn: async () =>
      (
        await categoriesService.list({
          page,
          pageSize,
          search,
          sortBy: "createdDate",
          sortDir: "desc",
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Category deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: categoriesQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete category"),
  });

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No categories to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `categories-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Code", "Description", "Status"],
        rows: rows.map((item) => [
          item.name,
          item.code,
          item.description ?? "",
          item.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(
        `Exported ${rows.length} categor${rows.length === 1 ? "y" : "ies"} to CSV`,
      );
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiCategory>[]>(
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
        id: "description",
        header: "Description",
        accessor: (item) => item.description || "—",
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

  const rowActions = useMemo<DataTableRowAction<ApiCategory>[]>(
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
        title="Categories"
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
            <Can route={CATEGORIES_ROUTE} action="modify">
              <Button size="sm" onClick={() => setMode({ kind: "create" })}>
                <Plus className="h-4 w-4" />
                Add category
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
        loadingText="Loading categories…"
        error={
          query.isError
            ? {
                title: "Unable to load categories",
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
          "aria-label": "Search categories",
        }}
        emptyState={{
          title: "No categories found.",
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
          itemLabel: "categories",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {mode && (
        <CategoryFormModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            qc.invalidateQueries({ queryKey: categoriesQueryKey });
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
              Delete category “{confirmDel.name}”?
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

function CategoryFormModal({
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
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: CategoryPayload) => {
      if (mode.kind === "edit") return categoriesService.update(mode.item.id, payload);
      return categoriesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message || (mode.kind === "edit" ? "Category updated" : "Category created"),
      );
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save category"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      description: values.description.trim(),
      // Backend-managed; keep existing on edit, default 0 on create.
      orderBy: existing?.orderBy ?? 0,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create"
      ? "Add category"
      : mode.kind === "edit"
        ? "Edit category"
        : "View category";

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <Form form={form} onSubmit={submit} className="space-y-4">
        <fieldset disabled={isView} className="space-y-4">
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
          <TextareaField<Values>
            name="description"
            label="Description"
            rows={3}
            maxLength={DESCRIPTION_MAX_LENGTH}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SwitchField<Values>
              name="isActive"
              label="Active"
            />
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 border-t pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {isView ? "Close" : "Cancel"}
          </Button>
          {!isView && (
            <SubmitButton loadingText="Saving…">
              {mode.kind === "edit" ? "Update category" : "Create category"}
            </SubmitButton>
          )}
        </div>
      </Form>
    </Modal>
  );
}
