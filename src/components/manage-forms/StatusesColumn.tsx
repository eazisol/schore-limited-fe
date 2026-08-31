import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  TextField,
  TextareaField,
  SwitchField,
  SubmitButton,
  SearchableSelectField,
} from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import {
  statusesService,
  type ApiStatus,
  type StatusPayload,
} from "@/lib/api/services/statuses";
import { fetchDocumentTypeOptions } from "@/lib/api/services/document-types";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import {
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
} from "./LookupColumnCard";
import { LookupSplitLayout } from "./LookupSplitLayout";
import { useManageFormsPermissions } from "./useManageFormsPermissions";

const statusesQueryKey = ["statuses"] as const;
const lookupsKey = ["lookups", "statuses"] as const;
const PAGE_SIZE = 50;
const STATUS_NAME_MAX_LENGTH = 50;
const STATUS_CODE_MAX_LENGTH = 20;

const schema = z.object({
  name: nameSchema("Name", STATUS_NAME_MAX_LENGTH),
  code: codeSchema("Code", STATUS_CODE_MAX_LENGTH),
  documentTypeId: z.string().trim().min(1, "Document type is required"),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiStatus }
  | { kind: "view"; item: ApiStatus };

export function StatusesColumn() {
  const qc = useQueryClient();
  const { canModify, canDelete } = useManageFormsPermissions();
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [confirmDel, setConfirmDel] = useState<ApiStatus | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...statusesQueryKey, "manage-forms", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (await statusesService.list({ page, pageSize: PAGE_SIZE, search })).data,
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
    mutationFn: (id: number) => statusesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Status deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        setMode({ kind: "create" });
      }
      qc.invalidateQueries({ queryKey: statusesQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete status"),
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: statusesQueryKey });
    qc.invalidateQueries({ queryKey: lookupsKey });
    setMode({ kind: "create" });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Statuses"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search by name or code…"
            searchAriaLabel="Search statuses"
            canAdd={canModify}
            onAdd={() => setMode({ kind: "create" })}
            addAriaLabel="Add status"
            loading={query.isLoading}
            fetching={query.isFetching}
            loadingText="Loading statuses…"
            error={
              query.isError
                ? {
                    title: "Unable to load statuses",
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
                  title="No statuses found."
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
                  itemLabel="statuses"
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
                    subtitle={[item.code, item.documentTypeName].filter(Boolean).join(" · ")}
                    description={item.description}
                    inactive={!item.isActive}
                    selected={selectedId === item.id}
                    canEdit={canModify}
                    canDelete={canDelete}
                    onEdit={() =>
                      setMode({ kind: canModify ? "edit" : "view", item })
                    }
                    onDelete={() => setConfirmDel(item)}
                  />
                ))}
              </LookupItemList>
            ) : null}
          </LookupColumnCard>
        }
        form={
          <StatusFormPanel
            key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onCancel={() => setMode({ kind: "create" })}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete status “${confirmDel.name}”?`}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function StatusFormPanel({
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
      documentTypeId: existing?.documentTypeId ? String(existing.documentTypeId) : "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: StatusPayload) => {
      if (mode.kind === "edit") return statusesService.update(mode.item.id, payload);
      return statusesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message || (mode.kind === "edit" ? "Status updated" : "Status created"));
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save status"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      documentTypeId: Number(values.documentTypeId),
      description: values.description.trim() || null,
      orderBy: existing?.orderBy ?? 0,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create" ? "Add status" : mode.kind === "edit" ? "Edit status" : "View status";

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
                {mode.kind === "edit" ? "Update status" : "Create status"}
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
          <SearchableSelectField<Values>
            name="documentTypeId"
            label="Document type"
            required
            placeholder="Select document type…"
            searchPlaceholder="Search document types…"
            queryKey={["lookups", "document-types", "form"]}
            fetchOptions={fetchDocumentTypeOptions}
            selectedLabel={existing?.documentTypeName}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField<Values>
              name="name"
              label="Name"
              required
              maxLength={STATUS_NAME_MAX_LENGTH}
            />
            <TextField<Values>
              name="code"
              label="Code"
              required
              maxLength={STATUS_CODE_MAX_LENGTH}
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
        </fieldset>
      </LookupFormPanel>
    </Form>
  );
}
