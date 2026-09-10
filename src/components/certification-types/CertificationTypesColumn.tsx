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
  certificationTypesService,
  type ApiCertificationType,
  type CertificationTypePayload,
} from "@/lib/api/services/certification-types";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { CERTIFICATION_TYPES_ROUTE } from "@/lib/certification-types";
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

export const certificationTypesQueryKey = ["certification-types"] as const;
const lookupsKey = ["lookups", "certification-types"] as const;
const PAGE_SIZE = 50;

const schema = z.object({
  name: nameSchema("Name", 100),
  code: codeSchema("Code", CODE_MAX_LENGTH),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiCertificationType }
  | { kind: "view"; item: ApiCertificationType };

export function CertificationTypesColumn() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: CERTIFICATION_TYPES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: CERTIFICATION_TYPES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [confirmDel, setConfirmDel] = useState<ApiCertificationType | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...certificationTypesQueryKey, "split", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (await certificationTypesService.list({ page, pageSize: PAGE_SIZE, search })).data,
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
    mutationFn: (id: string) => certificationTypesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Certification type deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        setMode({ kind: "create" });
      }
      qc.invalidateQueries({ queryKey: certificationTypesQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete certification type"),
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: certificationTypesQueryKey });
    qc.invalidateQueries({ queryKey: lookupsKey });
    setMode({ kind: "create" });
  }

  return (
    <div className="flex min-w-0 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Certification types"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search by name or code…"
            searchAriaLabel="Search certification types"
            canAdd={canModify}
            onAdd={() => setMode({ kind: "create" })}
            addAriaLabel="Add certification type"
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
            empty={
              !query.isLoading && !query.isError && rows.length === 0 ? (
                <LookupEmptyState
                  title="No certification types found."
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
                  itemLabel="types"
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
          <CertificationTypeFormPanel
            key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onCancel={() => setMode({ kind: "create" })}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete certification type “${confirmDel.name}”?`}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function CertificationTypeFormPanel({
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
    mutationFn: async (payload: CertificationTypePayload) => {
      if (mode.kind === "edit") return certificationTypesService.update(mode.item.id, payload);
      return certificationTypesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message ||
          (mode.kind === "edit" ? "Certification type updated" : "Certification type created"),
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
      <LookupFormPanel
        title={title}
        headerActions={
          <SwitchField<Values> name="isActive" label="Active" disabled={isView} />
        }
        footer={
          <div className="flex justify-end gap-2">
            {mode.kind !== "create" ? (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                New
              </Button>
            ) : null}
            {!isView ? (
              <SubmitButton size="sm" loadingText="Saving…">
                {mode.kind === "edit" ? "Update type" : "Create type"}
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
            <TextField<Values> name="name" label="Name" required autoFocus maxLength={100} />
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
