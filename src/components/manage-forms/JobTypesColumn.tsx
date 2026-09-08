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
  JobTypeTemplateSequenceFields,
  jobTypeTemplateItemSchema,
  mapApiTemplateItems,
  toTemplateItemPayload,
} from "@/components/job-types/JobTypeTemplateSequenceFields";
import {
  jobTypesService,
  type ApiJobType,
  type JobTypePayload,
} from "@/lib/api/services/job-types";
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

const jobTypesQueryKey = ["job-types"] as const;
const lookupsKey = ["lookups", "job-types"] as const;
const PAGE_SIZE = 50;
const JOB_TYPE_NAME_MAX_LENGTH = 50;
const JOB_TYPE_CODE_MAX_LENGTH = 20;

const schema = z.object({
  name: nameSchema("Name", JOB_TYPE_NAME_MAX_LENGTH),
  code: codeSchema("Code", JOB_TYPE_CODE_MAX_LENGTH),
  description: descriptionSchema(),
  durationWorkingDays: z.coerce.number().int().min(0).max(365),
  isActive: z.boolean(),
  templateItems: z.array(jobTypeTemplateItemSchema),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiJobType }
  | { kind: "view"; item: ApiJobType };

export function JobTypesColumn() {
  const qc = useQueryClient();
  const { canModify, canDelete } = useManageFormsPermissions();
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [confirmDel, setConfirmDel] = useState<ApiJobType | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...jobTypesQueryKey, "manage-forms", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (await jobTypesService.list({ page, pageSize: PAGE_SIZE, search })).data,
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
    mutationFn: (id: string) => jobTypesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Job type deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        setMode({ kind: "create" });
      }
      qc.invalidateQueries({ queryKey: jobTypesQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete job type"),
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: jobTypesQueryKey });
    qc.invalidateQueries({ queryKey: lookupsKey });
    setMode({ kind: "create" });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Job Types"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search by name or code…"
            searchAriaLabel="Search job types"
            canAdd={canModify}
            onAdd={() => setMode({ kind: "create" })}
            addAriaLabel="Add job type"
            loading={query.isLoading}
            fetching={query.isFetching}
            loadingText="Loading job types…"
            error={
              query.isError
                ? {
                    title: "Unable to load job types",
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
                  title="No job types found."
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
                  itemLabel="job types"
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
          <JobTypeFormPanel
            key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onCancel={() => setMode({ kind: "create" })}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete job type “${confirmDel.name}”?`}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function JobTypeFormPanel({
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

  const detailQuery = useQuery({
    queryKey: [...jobTypesQueryKey, "detail", existing?.id],
    queryFn: async () => (await jobTypesService.get(existing!.id)).data,
    enabled: Boolean(existing?.id),
  });
  const detail = detailQuery.data ?? existing;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      code: "",
      description: "",
      durationWorkingDays: 0,
      isActive: true,
      templateItems: [],
    },
  });

  useEffect(() => {
    if (mode.kind === "create") {
      form.reset({
        name: "",
        code: "",
        description: "",
        durationWorkingDays: 0,
        isActive: true,
        templateItems: [],
      });
      return;
    }
    if (!detail) return;
    form.reset({
      name: detail.name ?? "",
      code: detail.code ?? "",
      description: detail.description ?? "",
      durationWorkingDays: detail.durationWorkingDays ?? 0,
      isActive: detail.isActive ?? true,
      templateItems: mapApiTemplateItems(detail.templateItems),
    });
  }, [detail, form, mode.kind]);

  const mutation = useMutation({
    mutationFn: async (payload: JobTypePayload) => {
      if (mode.kind === "edit") return jobTypesService.update(mode.item.id, payload);
      return jobTypesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message || (mode.kind === "edit" ? "Job type updated" : "Job type created"),
      );
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save job type"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      description: values.description.trim() || null,
      durationWorkingDays: values.durationWorkingDays,
      orderBy: existing?.orderBy ?? 0,
      isActive: values.isActive,
      templateItems: toTemplateItemPayload(values.templateItems),
    });
  }

  const title =
    mode.kind === "create"
      ? "Add job type"
      : mode.kind === "edit"
        ? "Edit job type"
        : "View job type";

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
                {mode.kind === "edit" ? "Update job type" : "Create job type"}
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
            <TextField<Values>
              name="name"
              label="Name"
              required
              maxLength={JOB_TYPE_NAME_MAX_LENGTH}
            />
            <TextField<Values>
              name="code"
              label="Code"
              required
              maxLength={JOB_TYPE_CODE_MAX_LENGTH}
              transformValue={normalizeCodeInput}
              inputClassName="uppercase"
            />
            <TextField<Values>
              name="durationWorkingDays"
              label="Duration (working days)"
              type="number"
              required
            />
            <TextareaField<Values>
              name="description"
              label="Description"
              rows={2}
              maxLength={DESCRIPTION_MAX_LENGTH}
              className="sm:col-span-2"
            />
          </div>

          <JobTypeTemplateSequenceFields form={form} isView={isView} />
        </fieldset>
      </LookupFormPanel>
    </Form>
  );
}
