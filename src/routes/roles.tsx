import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import { Form, TextField, TextareaField, CheckboxField, SubmitButton } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { rolesService, type ApiRole, type RolePayload } from "@/lib/api/services/system-config";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { ROLES_ROUTE } from "@/lib/roles";
import { activeStatusClass } from "@/lib/module-ui";

export const Route = createFileRoute("/roles")({
  head: () => ({ meta: [{ title: "Roles | Schore" }] }),
  component: RolesPage,
});

export const rolesQueryKey = ["roles", "list"] as const;

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
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode = { kind: "create" } | { kind: "edit"; role: ApiRole } | { kind: "view"; role: ApiRole };

function RolesPage() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: ROLES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: ROLES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiRole | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...rolesQueryKey, { page, pageSize, search }],
    queryFn: async () => (await rolesService.list({ page, pageSize, search })).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rolesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Role deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: rolesQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete role"),
  });

  const columns = useMemo<DataTableColumn<ApiRole>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessor: (role) => role.name,
        cell: (role) => <span className="font-medium">{role.name}</span>,
      },
      {
        id: "code",
        header: "Code",
        cell: (role) => <span className="text-muted-foreground">{role.code}</span>,
      },
      {
        id: "description",
        header: "Description",
        accessor: (role) => role.description || "—",
        cellClassName: "text-muted-foreground",
        cell: (role) => role.description || "—",
      },
      {
        id: "status",
        header: "Status",
        cell: (role) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(role.isActive)}`}
          >
            {role.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiRole>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (role) => setMode({ kind: "view", role }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (role) => setMode({ kind: "edit", role }),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (role) => setConfirmDel(role),
      },
    ],
    [canDelete, canModify],
  );

  return (
    <div>
      <PageHeader title="Roles" />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(role) => role.id}
        loading={query.isLoading}
        fetching={query.isFetching}
        loadingText="Loading roles…"
        error={
          query.isError
            ? {
                title: "Unable to load roles",
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
          "aria-label": "Search roles",
        }}
        toolbarActions={
          <Can route={ROLES_ROUTE} action="modify">
            <Button size="sm" onClick={() => setMode({ kind: "create" })}>
              <Plus className="h-4 w-4" /> Add role
            </Button>
          </Can>
        }
        emptyState={{
          title: "No roles found.",
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
          itemLabel: "roles",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {mode && (
        <RoleFormModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            qc.invalidateQueries({ queryKey: rolesQueryKey });
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
              Delete role “{confirmDel.name}”?
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

function RoleFormModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isView = mode.kind === "view";
  const existing = mode.kind === "create" ? null : mode.role;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      code: existing?.code ?? "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: RolePayload) => {
      if (mode.kind === "edit") return rolesService.update(mode.role.id, payload);
      return rolesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message || (mode.kind === "edit" ? "Role updated" : "Role created"));
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save role"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      code: values.code.trim(),
      description: values.description.trim(),
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create" ? "Add role" : mode.kind === "edit" ? "Edit role" : "View role";

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
          <TextareaField<Values>
            name="description"
            label="Description"
            rows={3}
            maxLength={500}
          />
          <CheckboxField<Values> name="isActive" label="Active" />
        </fieldset>
        <div className="flex justify-end gap-2 border-t pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {isView ? "Close" : "Cancel"}
          </Button>
          {!isView && (
            <SubmitButton loadingText="Saving…">
              {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {mode.kind === "edit" ? "Update role" : "Create role"}
            </SubmitButton>
          )}
        </div>
      </Form>
    </Modal>
  );
}
