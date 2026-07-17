import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import { Form, TextField, CheckboxField, SubmitButton } from "@/components/form";
import { Can, usePathPermission } from "@/components/Permission";
import {
  DataTable,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import {
  userTypesService,
  type ApiUserType,
  type UserTypePayload,
} from "@/lib/api/services/system-config";
import { notifyApiError, type ApiError } from "@/lib/api/axios";

export const Route = createFileRoute("/settings/user-types")({
  head: () => ({ meta: [{ title: "User Types | Settings" }] }),
  component: UserTypesPage,
});

const listKey = ["settings", "user-types"] as const;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or fewer"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(50, "Code must be 50 characters or fewer"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiUserType }
  | { kind: "view"; item: ApiUserType };

function UserTypesPage() {
  const qc = useQueryClient();
  const canModify = usePathPermission("modify");
  const canDelete = usePathPermission("delete");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiUserType | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...listKey, { page, pageSize, search }],
    queryFn: async () => (await userTypesService.list({ page, pageSize, search })).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userTypesService.remove(id),
    onSuccess: () => {
      toast.success("User type deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: listKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete user type"),
  });

  const columns = useMemo<DataTableColumn<ApiUserType>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (item) => <span className="font-medium">{item.name}</span>,
      },
      {
        id: "code",
        header: "Code",
        cell: (item) => <span className="text-muted-foreground">{item.code}</span>,
      },
      {
        id: "status",
        header: "Status",
        headerClassName: "w-24",
        cell: (item) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              item.isActive
                ? "border-success/20 bg-success/10 text-success"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {item.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiUserType>[]>(
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
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(item) => item.id}
        loading={query.isLoading}
        fetching={query.isFetching}
        loadingText="Loading user types…"
        error={
          query.isError
            ? {
                title: "Unable to load user types",
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
          "aria-label": "Search user types",
        }}
        toolbarActions={
          <Can action="modify">
            <Button size="sm" onClick={() => setMode({ kind: "create" })}>
              <Plus className="h-4 w-4" /> Add user type
            </Button>
          </Can>
        }
        emptyState={{
          title: "No user types found.",
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
          itemLabel: "user types",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {mode && (
        <UserTypeFormModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            qc.invalidateQueries({ queryKey: listKey });
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
              Delete user type “{confirmDel.name}”?
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

function UserTypeFormModal({
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
    defaultValues: {
      name: existing?.name ?? "",
      code: existing?.code ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: UserTypePayload) => {
      if (mode.kind === "edit") return userTypesService.update(mode.item.id, payload);
      return userTypesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message || (mode.kind === "edit" ? "User type updated" : "User type created"),
      );
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save user type"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      code: values.code.trim(),
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create"
      ? "Add user type"
      : mode.kind === "edit"
        ? "Edit user type"
        : "View user type";

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
              maxLength={50}
            />
            <TextField<Values> name="code" label="Code" required maxLength={50} />
          </div>
          <CheckboxField<Values> name="isActive" label="Active" />
        </fieldset>
        <div className="flex justify-end gap-2 border-t pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {isView ? "Close" : "Cancel"}
          </Button>
          {!isView && (
            <SubmitButton loadingText="Saving…">
              {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {mode.kind === "edit" ? "Update user type" : "Create user type"}
            </SubmitButton>
          )}
        </div>
      </Form>
    </Modal>
  );
}
