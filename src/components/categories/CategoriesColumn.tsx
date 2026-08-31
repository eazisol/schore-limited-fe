import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, TextField, TextareaField, SwitchField, SubmitButton } from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import { usePermission } from "@/components/Permission";
import {
  categoriesService,
  type ApiCategory,
  type CategoryPayload,
} from "@/lib/api/services/units-categories";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
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

export const categoriesQueryKey = ["categories"] as const;
const lookupsKey = ["lookups", "categories"] as const;
const PAGE_SIZE = 50;

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

export function CategoriesColumn() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: CATEGORIES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: CATEGORIES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [confirmDel, setConfirmDel] = useState<ApiCategory | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...categoriesQueryKey, "split", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (
        await categoriesService.list({
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
    mutationFn: (id: number) => categoriesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Category deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        setMode({ kind: "create" });
      }
      qc.invalidateQueries({ queryKey: categoriesQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete category"),
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: categoriesQueryKey });
    qc.invalidateQueries({ queryKey: lookupsKey });
    setMode({ kind: "create" });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Categories"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search by name or code…"
            searchAriaLabel="Search categories"
            canAdd={canModify}
            onAdd={() => setMode({ kind: "create" })}
            addAriaLabel="Add category"
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
            empty={
              !query.isLoading && !query.isError && rows.length === 0 ? (
                <LookupEmptyState
                  title="No categories found."
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
                  itemLabel="categories"
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
                    subtitle={item.code}
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
          <CategoryFormPanel
            key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onCancel={() => setMode({ kind: "create" })}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete category “${confirmDel.name}”?`}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function CategoryFormPanel({
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
    <Form form={form} onSubmit={submit} className="contents">
      <LookupFormPanel
        title={title}
        headerActions={<SwitchField<Values> name="isActive" label="Active" disabled={isView} />}
        footer={
          <div className="flex justify-end gap-2">
            {mode.kind !== "create" ? (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                New
              </Button>
            ) : null}
            {!isView ? (
              <SubmitButton size="sm" loadingText="Saving…">
                {mode.kind === "edit" ? "Update category" : "Create category"}
              </SubmitButton>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                Close
              </Button>
            )}
          </div>
        }
      >
        <fieldset disabled={isView} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField<Values> name="name" label="Name" required maxLength={NAME_MAX_LENGTH} />
            <TextField<Values>
              name="code"
              label="Code"
              required
              maxLength={CODE_MAX_LENGTH}
              transformValue={normalizeCodeInput}
              inputClassName="uppercase"
            />
            <TextareaField<Values>
              name="description"
              label="Description"
              rows={3}
              maxLength={DESCRIPTION_MAX_LENGTH}
              className="sm:col-span-2"
            />
          </div>
        </fieldset>
      </LookupFormPanel>
    </Form>
  );
}
