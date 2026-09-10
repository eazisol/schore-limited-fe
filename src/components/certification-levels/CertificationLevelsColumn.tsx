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
  type SearchableSelectOption,
} from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import { usePermission } from "@/components/Permission";
import {
  certificationLevelsService,
  type ApiCertificationLevel,
  type CertificationLevelPayload,
} from "@/lib/api/services/certification-levels";
import { certificationTypesService } from "@/lib/api/services/certification-types";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { CERTIFICATION_LEVELS_ROUTE } from "@/lib/certification-levels";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
  normalizeCodeInput,
} from "@/lib/field-validation";
import { DROPDOWN_FETCH_SIZE } from "@/lib/dropdown-fetch";
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

export const certificationLevelsQueryKey = ["certification-levels"] as const;
const lookupsKey = ["lookups", "certification-levels"] as const;
const PAGE_SIZE = 50;

const schema = z.object({
  name: nameSchema("Name", 100),
  code: codeSchema("Code", CODE_MAX_LENGTH),
  certificationTypeId: z.string().trim().min(1, "Certification type is required"),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiCertificationLevel }
  | { kind: "view"; item: ApiCertificationLevel };

async function fetchCertificationTypeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await certificationTypesService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
  });
  return (res.data.items ?? [])
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || `Type ${row.id}`,
    }));
}

export function CertificationLevelsColumn() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: CERTIFICATION_LEVELS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: CERTIFICATION_LEVELS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [confirmDel, setConfirmDel] = useState<ApiCertificationLevel | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...certificationLevelsQueryKey, "split", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (await certificationLevelsService.list({ page, pageSize: PAGE_SIZE, search })).data,
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
    mutationFn: (id: string) => certificationLevelsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Certification level deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        setMode({ kind: "create" });
      }
      qc.invalidateQueries({ queryKey: certificationLevelsQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete certification level"),
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: certificationLevelsQueryKey });
    qc.invalidateQueries({ queryKey: lookupsKey });
    setMode({ kind: "create" });
  }

  return (
    <div className="flex min-w-0 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Certification levels"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search by name or code…"
            searchAriaLabel="Search certification levels"
            canAdd={canModify}
            onAdd={() => setMode({ kind: "create" })}
            addAriaLabel="Add certification level"
            loading={query.isLoading}
            fetching={query.isFetching}
            loadingText="Loading certification levels…"
            error={
              query.isError
                ? {
                    title: "Unable to load certification levels",
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
                  title="No certification levels found."
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
                  itemLabel="levels"
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
                    subtitle={item.certificationTypeName || undefined}
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
          <CertificationLevelFormPanel
            key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onCancel={() => setMode({ kind: "create" })}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete certification level “${confirmDel.name}”?`}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function CertificationLevelFormPanel({
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
      certificationTypeId: existing?.certificationTypeId
        ? String(existing.certificationTypeId)
        : "",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: CertificationLevelPayload) => {
      if (mode.kind === "edit") return certificationLevelsService.update(mode.item.id, payload);
      return certificationLevelsService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message ||
          (mode.kind === "edit" ? "Certification level updated" : "Certification level created"),
      );
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save certification level"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      certificationTypeId: values.certificationTypeId.trim(),
      description: values.description.trim() || null,
      orderBy: existing?.orderBy ?? 0,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create"
      ? "Add certification level"
      : mode.kind === "edit"
        ? "Edit certification level"
        : "View certification level";

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
                {mode.kind === "edit" ? "Update level" : "Create level"}
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
          <SearchableSelectField<Values>
            name="certificationTypeId"
            label="Certification type"
            required
            placeholder="Select type"
            searchPlaceholder="Search types…"
            queryKey={["lookups", "certification-types"]}
            selectedLabel={existing?.certificationTypeName}
            fetchOptions={fetchCertificationTypeOptions}
            disabled={isView}
          />
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
