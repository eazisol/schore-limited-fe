import { useEffect, useMemo, useState } from "react";
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
  SearchableMultiSelectField,
} from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import {
  daySuggestionsService,
  type ApiDaySuggestion,
  type DaySuggestionPayload,
} from "@/lib/api/services/day-suggestions";
import { tradesService } from "@/lib/api/services/trades";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { DESCRIPTION_MAX_LENGTH, descriptionSchema } from "@/lib/field-validation";
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

const daySuggestionsQueryKey = ["day-suggestions"] as const;
const tradeOptionsQueryKey = ["lookups", "trades", "day-suggestions"] as const;
const PAGE_SIZE = 50;

async function fetchTradeOptions(search: string) {
  const res = await tradesService.list({
    page: 1,
    pageSize: 50,
    search: search.trim() || undefined,
    sortBy: "name",
    sortDir: "asc",
  });
  return (res.data?.items ?? [])
    .filter((trade) => trade.isActive)
    .map((trade) => ({
      value: String(trade.id),
      label: `${trade.code} — ${trade.name}`,
      code: trade.code,
    }));
}

function tradeLabel(item: ApiDaySuggestion) {
  if (item.codes?.trim()) return item.codes;
  if (item.tradeCodes?.length) return item.tradeCodes.join(", ");
  return "";
}

const schema = z.object({
  dayNumber: z.coerce
    .number({ invalid_type_error: "Day number must be a number" })
    .int("Day number must be a whole number")
    .min(1, "Day number must be 1 or greater"),
  tradeIds: z.array(z.string().min(1)).min(1, "Select at least one trade"),
  description: descriptionSchema(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiDaySuggestion }
  | { kind: "view"; item: ApiDaySuggestion };

export function DaySuggestionsColumn() {
  const qc = useQueryClient();
  const { canModify, canDelete } = useManageFormsPermissions();
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [confirmDel, setConfirmDel] = useState<ApiDaySuggestion | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...daySuggestionsQueryKey, "manage-forms", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (await daySuggestionsService.list({ page, pageSize: PAGE_SIZE, search })).data,
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
    mutationFn: (id: number) => daySuggestionsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Day suggestion deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        setMode({ kind: "create" });
      }
      qc.invalidateQueries({ queryKey: daySuggestionsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete day suggestion"),
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: daySuggestionsQueryKey });
    setMode({ kind: "create" });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Day suggestions"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search by day or trade…"
            searchAriaLabel="Search day suggestions"
            canAdd={canModify}
            onAdd={() => setMode({ kind: "create" })}
            addAriaLabel="Add day suggestion"
            loading={query.isLoading}
            fetching={query.isFetching}
            loadingText="Loading day suggestions…"
            error={
              query.isError
                ? {
                    title: "Unable to load day suggestions",
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
                  title="No day suggestions found."
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
                  itemLabel="suggestions"
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
                    label={`Day ${item.dayNumber}`}
                    subtitle={tradeLabel(item) || undefined}
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
          <DaySuggestionFormPanel
            key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onCancel={() => setMode({ kind: "create" })}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete Day ${confirmDel.dayNumber} suggestion?`}
          description={`Trades “${tradeLabel(confirmDel) || "—"}” will no longer appear in Next Day. This action cannot be undone.`}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function DaySuggestionFormPanel({
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

  const selectedLabels = useMemo(() => {
    if (!existing) return undefined;
    const labels: Record<string, string> = {};
    const ids = existing.tradeIds ?? [];
    const codes = existing.tradeCodes ?? [];
    const names = existing.tradeNames ?? [];
    ids.forEach((id, index) => {
      const code = codes[index] ?? "";
      const name = names[index] ?? "";
      labels[String(id)] = code && name ? `${code} — ${name}` : code || name || String(id);
    });
    return labels;
  }, [existing]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    defaultValues: {
      dayNumber: existing?.dayNumber ?? 1,
      tradeIds: (existing?.tradeIds ?? []).map(String),
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: DaySuggestionPayload) => {
      if (mode.kind === "edit") return daySuggestionsService.update(mode.item.id, payload);
      return daySuggestionsService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(
        res.message || (mode.kind === "edit" ? "Day suggestion updated" : "Day suggestion created"),
      );
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save day suggestion"),
  });

  async function submit(values: Values) {
    await mutation.mutateAsync({
      dayNumber: values.dayNumber,
      tradeIds: values.tradeIds.map((id) => id.trim()).filter((id) => id.length > 0),
      description: values.description.trim() || null,
      orderBy: 0,
      isActive: values.isActive,
    });
  }

  const title =
    mode.kind === "create"
      ? "Add day suggestion"
      : mode.kind === "edit"
        ? "Edit day suggestion"
        : "View day suggestion";

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
                {mode.kind === "edit" ? "Update suggestion" : "Create suggestion"}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <TextField<Values>
              name="dayNumber"
              label="Day number"
              type="number"
              min={1}
              step={1}
              required
              className="w-full sm:w-32"
            />
            <SearchableMultiSelectField<Values>
              name="tradeIds"
              label="Suggested trades"
              required
              placeholder="Select trades…"
              searchPlaceholder="Search trades…"
              queryKey={tradeOptionsQueryKey}
              fetchOptions={fetchTradeOptions}
              selectedLabels={selectedLabels}
              className="min-w-0 flex-1"
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
