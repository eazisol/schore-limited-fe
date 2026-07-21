import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, TextField, TextareaField, CheckboxField, SubmitButton } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { tradesService, type TradePayload } from "@/lib/api/services/trades";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { tradesQueryKey } from "./trade-builder.index";
import { activeStatusClass, formatDateTime } from "@/lib/module-ui";

const TRADES_ROUTE = "/trade-builder";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/trade-builder/$id")({
  head: ({ params }) => ({ meta: [{ title: `Trade #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: TradeDetail,
});

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Trade name is required")
    .max(100, "Trade name must be 100 characters or fewer"),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

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

  function openView() {
    navigate({
      to: "/trade-builder/$id",
      params: { id },
      search: {},
      replace: true,
    });
  }

  const tradeQuery = useQuery({
    queryKey: ["trades", id],
    queryFn: async () => (await tradesService.get(id)).data,
  });
  const trade = tradeQuery.data;

  const defaults = useMemo<Values>(
    () => ({
      name: trade?.name ?? "",
      description: trade?.description ?? "",
      isActive: trade?.isActive ?? true,
    }),
    [trade],
  );

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => {
    if (!trade) return;
    form.reset(defaults);
  }, [trade, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: TradePayload) => tradesService.update(numericId, payload),
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

  async function save(values: Values) {
    await updateMutation.mutateAsync({
      name: values.name.trim(),
      description: values.description.trim() || null,
      isActive: values.isActive,
    });
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
          <Form form={form} onSubmit={save} className="card-elevated space-y-4 p-6 lg:col-span-2">
            <h3 className="font-display font-semibold">Edit details</h3>
            <fieldset className="space-y-4">
              <TextField<Values> name="name" label="Trade name" required maxLength={100} />
              <TextareaField<Values>
                name="description"
                label="Description"
                rows={3}
                maxLength={500}
              />
              <CheckboxField<Values>
                name="isActive"
                label="Active"
                description="Trade appears in operative and allocation dropdowns."
              />
            </fieldset>
            <div className="flex items-center justify-end gap-2 border-t pt-2">
              <span className="mr-auto text-xs text-muted-foreground">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => {
                  form.reset(defaults);
                  openView();
                }}
              >
                Cancel
              </Button>
              <SubmitButton disabled={!dirty} loadingText="Saving…">
                Save changes
              </SubmitButton>
            </div>
          </Form>
        ) : (
          <div className="card-elevated space-y-4 p-6 lg:col-span-2">
            <h3 className="font-display font-semibold">Trade details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="Name" value={trade.name} />
                <ReadOnlyField
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="Groups" value={String(trade.groupCount)} />
                <ReadOnlyField label="Tasks" value={String(trade.taskCount)} />
              </div>
              <ReadOnlyField label="Description" value={trade.description || "—"} />
            </div>
          </div>
        )}

        <div className="card-elevated self-start p-6">
          <h3 className="mb-4 font-display font-semibold">Record</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Trade ID">{trade.id}</Row>
            <Row label="Created">{formatDateTime(trade.createdDate)}</Row>
            <Row label="Last edited">{formatDateTime(trade.editDate)}</Row>
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
              This permanently removes the trade. Linked groups and tasks may become unavailable.
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

function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}
