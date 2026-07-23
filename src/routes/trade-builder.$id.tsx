import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { DetailField, DetailMetaRow } from "@/components/DetailField";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { tradesService } from "@/lib/api/services/trades";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { tradesQueryKey } from "./trade-builder.index";
import { activeStatusClass, formatDateTime } from "@/lib/module-ui";
import { TRADES_ROUTE } from "@/lib/trades";
import { tradeFormSchema, toTradePayload, type TradeFormValues } from "@/lib/trade-form";
import { TradeFormFields } from "@/components/trades/TradeFormFields";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/trade-builder/$id")({
  head: ({ params }) => ({ meta: [{ title: `Trade #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: TradeDetail,
});

function TradeDetail() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: TRADES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: TRADES_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;

  function openEdit() {
    navigate({
      to: "/trade-builder/$id",
      params: { id },
      search: { mode: "edit" },
      replace: true,
    });
  }

  const tradeQuery = useQuery({
    queryKey: ["trades", id],
    queryFn: async () => (await tradesService.get(id)).data,
  });
  const trade = tradeQuery.data;

  const defaults = useMemo<TradeFormValues>(
    () => ({
      name: trade?.name ?? "",
      code: trade?.code ?? "",
      description: trade?.description ?? "",
      isActive: trade?.isActive ?? true,
    }),
    [trade],
  );

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (!trade) return;
    form.reset(defaults);
  }, [trade, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toTradePayload>) =>
      tradesService.update(numericId, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Trade updated");
      queryClient.setQueryData(["trades", id], res.data);
      queryClient.invalidateQueries({ queryKey: tradesQueryKey });
      navigate({ to: "/trade-builder" });
    },
    onError: (err) => notifyApiError(err, "Failed to update trade"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tradesService.remove(numericId),
    onSuccess: (res) => {
      toast.success(res.message || "Trade deleted");
      queryClient.invalidateQueries({ queryKey: tradesQueryKey });
      navigate({ to: "/trade-builder" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete trade"),
  });

  async function save(values: TradeFormValues) {
    await updateMutation.mutateAsync(toTradePayload(values, trade?.orderBy ?? 0));
  }

  if (tradeQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading trade…
      </div>
    );
  }

  if (tradeQuery.isError || !trade) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load trade</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(tradeQuery.error as unknown as ApiError)?.message ||
            "This trade may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/trade-builder">Back to trades</Link>
        </Button>
      </div>
    );
  }

  const dirty = form.formState.isDirty;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? "Edit trade" : "Trade details"}
        leading={
          <AppTooltip content="Back to trades" asChild>
            <Link
              to="/trade-builder"
              aria-label="Back to trades"
              className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </AppTooltip>
        }
        actions={
          <>
            {!isEditing && canModify && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
                Edit trade
              </Button>
            )}
            <Can route={TRADES_ROUTE} action="delete">
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </Can>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {isEditing ? (
          <Form form={form} onSubmit={save} className="card-elevated space-y-4 p-4 sm:p-6 lg:col-span-2">
            <TradeFormFields disabled={updateMutation.isPending} />
            <div className="flex flex-col-reverse gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:pt-2">
              <span className="text-xs text-muted-foreground sm:mr-auto">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={() => navigate({ to: "/trade-builder" })}
                >
                  Cancel
                </Button>
                <SubmitButton disabled={!dirty} loadingText="Saving…">
                  Save changes
                </SubmitButton>
              </div>
            </div>
          </Form>
        ) : (
          <div className="card-elevated space-y-5 p-4 sm:p-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label="Name" value={trade.name} />
              <DetailField label="Code" value={trade.code} />
            </div>
            <DetailField label="Description" value={trade.description || "—"} />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField
                label="Status"
                value={
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(trade.isActive)}`}
                  >
                    {trade.isActive ? "Active" : "Inactive"}
                  </span>
                }
              />
            </div>
          </div>
        )}

        <div className="card-elevated self-start p-6">
          <h3 className="mb-4 font-display font-semibold">Record</h3>
          <dl className="space-y-3">
            <DetailMetaRow label="Trade ID">{trade.id}</DetailMetaRow>
            <DetailMetaRow label="Created">{formatDateTime(trade.createdDate)}</DetailMetaRow>
            <DetailMetaRow label="Last edited">{formatDateTime(trade.editDate)}</DetailMetaRow>
          </dl>
        </div>
      </div>

      {confirmDel && canDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmDel(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Delete {trade.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the trade. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDel(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete trade
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
