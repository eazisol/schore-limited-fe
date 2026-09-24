import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, TextField, TextareaField, SwitchField, SubmitButton } from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import {
  holdReasonsService,
  type ApiHoldReason,
  type HoldReasonPayload,
} from "@/lib/api/services/hold-reasons";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { DESCRIPTION_MAX_LENGTH, descriptionSchema, nameSchema } from "@/lib/field-validation";
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

const holdReasonsQueryKey = ["hold-reasons"] as const;
const lookupsKey = ["lookups", "hold-reasons"] as const;
const PAGE_SIZE = 50;

const schema = z.object({
  name: nameSchema("Name", 50),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const emptyValues: Values = {
  name: "",
  description: "",
  isActive: true,
};

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiHoldReason }
  | { kind: "view"; item: ApiHoldReason };

export function HoldReasonsColumn() {
  const qc = useQueryClient();
  const { canModify, canDelete } = useManageFormsPermissions();
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [createKey, setCreateKey] = useState(0);
  const [confirmDel, setConfirmDel] = useState<ApiHoldReason | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...holdReasonsQueryKey, "manage-forms", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (await holdReasonsService.list({ page, pageSize: PAGE_SIZE, search })).data,
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
    mutationFn: (id: number) => holdReasonsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Hold reason deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        startNew();
      }
      qc.invalidateQueries({ queryKey: holdReasonsQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete hold reason"),
  });

  function startNew() {
    setCreateKey((k) => k + 1);
    setMode({ kind: "create" });
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: holdReasonsQueryKey });
    qc.invalidateQueries({ queryKey: lookupsKey });
    startNew();
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Hold reasons"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search reasons…"
            searchAriaLabel="Search hold reasons"
            canAdd={canModify}
            onAdd={startNew}
            addAriaLabel="Add hold reason"
            loading={query.isLoading}
            fetching={query.isFetching}
            loadingText="Loading hold reasons…"
            error={
              query.isError
                ? {
                    title: "Unable to load hold reasons",
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
                  title="No hold reasons found."
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
                  itemLabel="reasons"
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
          <HoldReasonFormPanel
            key={mode.kind === "create" ? `create-${createKey}` : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onNew={startNew}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete hold reason “${confirmDel.name}”?`}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function HoldReasonFormPanel({
  mode,
  onNew,
  onSaved,
}: {
  mode: Mode;
  onNew: () => void;
  onSaved: () => void;
}) {
  const isView = mode.kind === "view";
  const existing = mode.kind === "create" ? null : mode.item;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    defaultValues: {
      name: existing?.name ?? "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: HoldReasonPayload) => {
      if (mode.kind === "edit") return holdReasonsService.update(mode.item.id, payload);
      return holdReasonsService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message || (mode.kind === "edit" ? "Hold reason updated" : "Hold reason created"),
      );
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save hold reason"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      description: values.description.trim() || null,
      orderBy: existing?.orderBy ?? 0,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create"
      ? "Add hold reason"
      : mode.kind === "edit"
        ? "Edit hold reason"
        : "View hold reason";

  return (
    <Form form={form} onSubmit={submit} className="contents">
      <LookupFormPanel
        title={title}
        headerActions={<SwitchField<Values> name="isActive" label="Active" disabled={isView} />}
        footer={
          <div className="flex justify-end gap-2">
            {!isView ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  form.reset(emptyValues);
                  onNew();
                }}
                disabled={mutation.isPending}
              >
                New
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={onNew}>
                New
              </Button>
            )}
            {!isView ? (
              <SubmitButton size="sm" loadingText="Saving…">
                {mode.kind === "edit" ? "Update reason" : "Create reason"}
              </SubmitButton>
            ) : null}
          </div>
        }
      >
        <fieldset disabled={isView} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField<Values> name="name" label="Name" required maxLength={50} />
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
