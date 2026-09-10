import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, TextField, TextareaField, SwitchField, SubmitButton } from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import { usePermission } from "@/components/Permission";
import { rolesService, type ApiRole, type RolePayload } from "@/lib/api/services/system-config";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { ROLES_ROUTE } from "@/lib/roles";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
  normalizeCodeInput,
} from "@/lib/field-validation";
import {
  DeleteConfirmDialog,
  LookupColumnCard,
  LookupColumnFooter,
  LookupEmptyState,
  LookupFormPanel,
  LookupItemList,
  LookupItemRow,
} from "@/components/manage-forms/LookupColumnCard";
import { LookupSplitLayout } from "@/components/manage-forms/LookupSplitLayout";

export const rolesQueryKey = ["roles", "list"] as const;
const PAGE_SIZE = 50;

const schema = z.object({
  name: nameSchema("Name", 50),
  code: codeSchema("Code", CODE_MAX_LENGTH),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiRole }
  | { kind: "view"; item: ApiRole };

export function RolesColumn() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: ROLES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: ROLES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [confirmDel, setConfirmDel] = useState<ApiRole | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...rolesQueryKey, "split", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (
        await rolesService.list({
          page,
          pageSize: PAGE_SIZE,
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
  const selectedId = mode.kind === "create" ? null : mode.item.id;

  useEffect(() => {
    if (!query.isFetching && page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [query.isFetching, page, totalPages]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Role deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        setMode({ kind: "create" });
      }
      qc.invalidateQueries({ queryKey: rolesQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete role"),
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: rolesQueryKey });
    setMode({ kind: "create" });
  }

  return (
    <div className="flex min-w-0 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Roles"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search by name or code…"
            searchAriaLabel="Search roles"
            canAdd={canModify}
            onAdd={() => setMode({ kind: "create" })}
            addAriaLabel="Add role"
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
            empty={
              !query.isLoading && !query.isError && rows.length === 0 ? (
                <LookupEmptyState
                  title="No roles found."
                  description={search ? "Try clearing the search." : undefined}
                  onClear={search ? clearSearch : undefined}
                />
              ) : null
            }
            footer={
              rows.length > 0 ? (
                <LookupColumnFooter
                  page={page}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  itemLabel="roles"
                  disabled={query.isFetching}
                  onPageChange={setPage}
                />
              ) : null
            }
          >
            {rows.length > 0 ? (
              <LookupItemList>
                {rows.map((item) => (
                  <LookupItemRow
                    key={item.id}
                    label={item.name}
                    code={item.code}
                    description={item.description}
                    inactive={!item.isActive}
                    selected={selectedId === item.id}
                    canEdit={canModify}
                    canDelete={canDelete}
                    onEdit={() => setMode({ kind: canModify ? "edit" : "view", item })}
                    onDelete={() => setConfirmDel(item)}
                  />
                ))}
              </LookupItemList>
            ) : null}
          </LookupColumnCard>
        }
        form={
          <RoleFormPanel
            key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onCancel={() => setMode({ kind: "create" })}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete role “${confirmDel.name}”?`}
          description="This permanently removes the role. Users assigned to it may need reassignment."
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function RoleFormPanel({
  mode,
  onCancel,
  onSaved,
}: {
  mode: Mode;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isView = mode.kind === "view";
  const existing = mode.kind === "create" ? null : mode.item;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      name: existing?.name ?? "",
      code: existing?.code ?? "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: RolePayload) => {
      if (mode.kind === "edit") return rolesService.update(mode.item.id, payload);
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
      code: values.code.trim().toUpperCase(),
      description: values.description.trim(),
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create" ? "Add role" : mode.kind === "edit" ? "Edit role" : "View role";

  return (
    <Form form={form} onSubmit={submit} className="contents">
      <LookupFormPanel
        title={title}
        headerActions={
          <SwitchField<Values> name="isActive" label="Active" disabled={isView} />
        }
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {existing ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to="/permissions" search={{ roleId: existing.id, from: "roles" }}>
                  Permissions
                </Link>
              </Button>
            ) : null}
            {mode.kind !== "create" ? (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                New
              </Button>
            ) : null}
            {!isView ? (
              <SubmitButton size="sm" loadingText="Saving…">
                {mode.kind === "edit" ? "Update role" : "Create role"}
              </SubmitButton>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                Close
              </Button>
            )}
          </div>
        }
      >
        <fieldset className="space-y-2" disabled={isView || mutation.isPending}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TextField<Values> name="name" label="Name" required autoFocus maxLength={50} />
            <TextField<Values>
              name="code"
              label="Code"
              required
              maxLength={CODE_MAX_LENGTH}
              transformValue={normalizeCodeInput}
            />
            <TextareaField<Values>
              name="description"
              label="Description"
              rows={2}
              maxLength={DESCRIPTION_MAX_LENGTH}
              className="sm:col-span-2"
            />
          </div>
        </fieldset>
      </LookupFormPanel>
    </Form>
  );
}
