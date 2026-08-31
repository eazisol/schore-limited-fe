import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import { usePermission } from "@/components/Permission";
import {
  tradesService,
  type ApiTrade,
  type TradePayload,
} from "@/lib/api/services/trades";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { TRADES_ROUTE } from "@/lib/trades";
import { tradeFormSchema, toTradePayload, type TradeFormValues } from "@/lib/trade-form";
import { TradeFormFields } from "@/components/trades/TradeFormFields";
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

export const tradesQueryKey = ["trades"] as const;
const PAGE_SIZE = 50;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; item: ApiTrade }
  | { kind: "view"; item: ApiTrade };

export function TradesColumn() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: TRADES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: TRADES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [confirmDel, setConfirmDel] = useState<ApiTrade | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...tradesQueryKey, "split", { page, pageSize: PAGE_SIZE, search }],
    queryFn: async () =>
      (
        await tradesService.list({
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
    mutationFn: (id: number) => tradesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Trade deleted");
      setConfirmDel(null);
      if (mode.kind !== "create" && confirmDel && mode.item.id === confirmDel.id) {
        setMode({ kind: "create" });
      }
      qc.invalidateQueries({ queryKey: tradesQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete trade"),
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: tradesQueryKey });
    setMode({ kind: "create" });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <LookupSplitLayout
        list={
          <LookupColumnCard
            title="Trades"
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search by name or code…"
            searchAriaLabel="Search trades"
            canAdd={canModify}
            onAdd={() => setMode({ kind: "create" })}
            addAriaLabel="Add trade"
            loading={query.isLoading}
            fetching={query.isFetching}
            loadingText="Loading trades…"
            error={
              query.isError
                ? {
                    title: "Unable to load trades",
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
                  title="No trades found."
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
                  itemLabel="trades"
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
          <TradeFormPanel
            key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.item.id}`}
            mode={mode}
            onCancel={() => setMode({ kind: "create" })}
            onSaved={handleSaved}
          />
        }
      />

      {confirmDel ? (
        <DeleteConfirmDialog
          title={`Delete ${confirmDel.name}?`}
          description="This permanently removes the trade. This action cannot be undone."
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
        />
      ) : null}
    </div>
  );
}

function TradeFormPanel({
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

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
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
    mutationFn: async (payload: TradePayload) => {
      if (mode.kind === "edit") return tradesService.update(mode.item.id, payload);
      return tradesService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message || (mode.kind === "edit" ? "Trade updated" : "Trade created"));
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save trade"),
  });

  async function submit(values: TradeFormValues) {
    await mutation.mutateAsync(toTradePayload(values, existing?.orderBy ?? 0));
  }

  const title =
    mode.kind === "create" ? "Add trade" : mode.kind === "edit" ? "Edit trade" : "View trade";

  return (
    <Form form={form} onSubmit={submit} className="contents">
      <LookupFormPanel
        title={title}
        headerActions={
          <SwitchField<TradeFormValues> name="isActive" label="Active" disabled={isView} />
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
                {mode.kind === "edit" ? "Update trade" : "Create trade"}
              </SubmitButton>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                Close
              </Button>
            )}
          </div>
        }
      >
        <TradeFormFields disabled={isView || mutation.isPending} showHeader={false} />
      </LookupFormPanel>
    </Form>
  );
}
