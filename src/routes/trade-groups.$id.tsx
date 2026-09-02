import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormPageCard } from "@/components/FormPageCard";
import { AppTooltip } from "@/components/AppTooltip";
import {
  DetailProfileHero,
  type DetailProfileHighlight,
} from "@/components/DetailProfileHero";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calculator, Layers, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { tradeGroupsService } from "@/lib/api/services/trade-groups";
import { productsService } from "@/lib/api/services/products";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { tradeGroupsQueryKey } from "./trade-groups.index";
import { CodeBadge } from "@/components/CodeBadge";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { truncateWithEllipsis } from "@/lib/module-ui";
import { fmtGBP } from "@/lib/data";
import { TRADE_GROUPS_ROUTE } from "@/lib/trade-groups";
import {
  tradeGroupFormSchema,
  toTradeGroupPayload,
  type TradeGroupFormValues,
} from "@/lib/trade-group-form";
import { TradeGroupFormFields } from "@/components/trade-groups/TradeGroupFormFields";
import { TradeGroupItemsEditor } from "@/components/trade-groups/TradeGroupItemsEditor";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/trade-groups/$id")({
  head: ({ params }) => ({ meta: [{ title: `Trade Group #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: TradeGroupDetail,
});

function TradeGroupDetail() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
    const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: TRADE_GROUPS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: TRADE_GROUPS_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;

  function openEdit() {
    navigate({
      to: "/trade-groups/$id",
      params: { id },
      search: { mode: "edit" },
      replace: true,
    });
  }

  function openView() {
    navigate({
      to: "/trade-groups/$id",
      params: { id },
      search: {},
      replace: true,
    });
  }

  const groupQuery = useQuery({
    queryKey: ["trade-groups", id],
    queryFn: async () => (await tradeGroupsService.get(id)).data,
  });
  const row = groupQuery.data;

  const productPricesQuery = useQuery({
    queryKey: ["products", "trade-group-prices"],
    queryFn: async () => {
      const res = await productsService.list({
        page: 1,
        pageSize: 500,
        sortBy: "name",
        sortDir: "asc",
      });
      const map = new Map<string, number>();
      for (const product of res.data.items ?? []) {
        map.set(String(product.id), product.salePrice ?? 0);
      }
      return map;
    },
    staleTime: 60_000,
  });

  const defaults = useMemo<TradeGroupFormValues>(() => {
    const items = [...(row?.items ?? [])].sort((a, b) => a.orderBy - b.orderBy);
    const priceMap = productPricesQuery.data;
    return {
      tradeId: row?.tradeId != null ? String(row.tradeId) : "",
      name: row?.name ?? "",
      code: row?.code ?? "",
      description: row?.description ?? "",
      isActive: row?.isActive ?? true,
      items: items.map((item) => {
        const storedPrice = item.salePrice;
        const catalogPrice = priceMap?.get(String(item.productId));
        const salePrice =
          storedPrice != null && Number.isFinite(Number(storedPrice))
            ? storedPrice
            : (catalogPrice ?? 0);
        return {
          id: String(item.id),
          productId: String(item.productId),
          productName: item.productName ?? "",
          productSku: item.productSku ?? "",
          categoryName: item.categoryName ?? "",
          unitId: item.unitId != null ? String(item.unitId) : "",
          unitName: item.unitName ?? "",
          quantity: String(item.quantity),
          salePrice: String(salePrice),
          notes: item.notes ?? "",
        };
      }),
    };
  }, [row, productPricesQuery.data]);

  const form = useForm<TradeGroupFormValues>({
    resolver: zodResolver(tradeGroupFormSchema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (!row) return;
    form.reset(defaults);
  }, [row, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toTradeGroupPayload>) =>
      tradeGroupsService.update(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Trade group updated");
      queryClient.setQueryData(["trade-groups", id], res.data);
      queryClient.invalidateQueries({ queryKey: tradeGroupsQueryKey });
      openView();
    },
    onError: (err) => notifyApiError(err, "Failed to update trade group"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tradeGroupsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Trade group deleted");
      queryClient.invalidateQueries({ queryKey: tradeGroupsQueryKey });
      navigate({ to: "/trade-groups" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete trade group"),
  });

  async function save(values: TradeGroupFormValues) {
    await updateMutation.mutateAsync(toTradeGroupPayload(values, row?.orderBy ?? 0));
  }

  if (groupQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading trade group…
      </div>
    );
  }

  if (groupQuery.isError || !row) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load trade group</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(groupQuery.error as unknown as ApiError)?.message ||
            "This trade group may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/trade-groups">Back to trade groups</Link>
        </Button>
      </div>
    );
  }

  const dirty = form.formState.isDirty;
  const items = [...(row.items ?? [])].sort((a, b) => a.orderBy - b.orderBy);
  const priceMap = productPricesQuery.data;
  const viewTotalPrice = items.reduce((sum, item) => {
    const qty = Number(item.quantity);
    const storedPrice = item.salePrice;
    const catalogPrice = priceMap?.get(String(item.productId));
    const price =
      storedPrice != null && Number.isFinite(Number(storedPrice))
        ? Number(storedPrice)
        : (catalogPrice ?? 0);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + qty * price;
  }, 0);

  const viewActions = (
    <>
      {canModify && (
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Pencil className="h-4 w-4" />
          Edit trade group
        </Button>
      )}
      <Can route={TRADE_GROUPS_ROUTE} action="delete">
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
  );

  const heroHighlights: DetailProfileHighlight[] = [
    { label: "Code", value: <CodeBadge code={row.code} /> },
    { label: "Items", value: String(items.length) },
    { label: "Total", value: fmtGBP(viewTotalPrice) },
  ];

  return (
    <div className="space-y-6">
      {isEditing ? (
          <Form form={form} onSubmit={save} className="w-full">
            <FormPageCard
              title="Edit trade group"
              onBack={{ label: "Back to trade group", onClick: openView }}
              headerActions={<SwitchField<TradeGroupFormValues> name="isActive" label="Active" />}
              maxWidth="w-full max-w-none"
              footer={
                <>
                  <span className="text-xs text-muted-foreground sm:mr-auto">
                    {dirty ? "Unsaved changes" : "All changes saved"}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={openView}
                    >
                      Cancel
                    </Button>
                    <SubmitButton size="sm" disabled={!dirty} loadingText="Saving…">
                      Save changes
                    </SubmitButton>
                  </div>
                </>
              }
            >
              <TradeGroupFormFields
                embedded
                disabled={updateMutation.isPending}
                tradeSelectedLabel={row.tradeName}
              />
              <TradeGroupItemsEditor disabled={updateMutation.isPending} embedded />
            </FormPageCard>
          </Form>
      ) : (
        <>
          <DetailProfileHero
            className="w-full"
            title="Trade group details"
            backLabel="Back to trade groups"
            backTo="/trade-groups"
            headerActions={viewActions}
            leading={
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-background bg-accent/90 text-accent-foreground shadow-sm sm:h-12 sm:w-12">
                <Layers className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
              </span>
            }
            name={row.name}
            subtitle={row.tradeName?.trim() || undefined}
            status={<ActiveStatusBadge isActive={row.isActive} />}
            description={row.description?.trim() || undefined}
            highlights={heroHighlights}
          />

          <div className="card-elevated overflow-hidden">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No items in this trade group.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="w-[28%] min-w-[12rem] px-4 py-2.5 text-left font-medium sm:px-6">
                          Product
                        </th>
                        <th className="w-[32%] min-w-[10rem] px-3 py-2.5 text-left font-medium">Notes</th>
                        <th className="px-3 py-2.5 text-left font-medium">Unit</th>
                        <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
                        <th className="px-3 py-2.5 text-right font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item) => {
                        const storedPrice = item.salePrice;
                        const catalogPrice = priceMap?.get(String(item.productId));
                        const unitPrice =
                          storedPrice != null && Number.isFinite(Number(storedPrice))
                            ? Number(storedPrice)
                            : (catalogPrice ?? 0);
                        const name =
                          item.productName?.trim() || `Product #${item.productId}`;
                        const sku = item.productSku?.trim() || "";
                        const truncatedSku = sku ? truncateWithEllipsis(sku, 10) : "";
                        const skuNeedsTooltip = sku.length > 10;
                        const notesText = item.notes?.trim() || "";
                        return (
                          <tr key={item.id}>
                            <td className="w-[28%] min-w-[12rem] px-4 py-3 align-top sm:px-6">
                              <div className="min-w-0">
                                <div className="break-words whitespace-normal font-medium leading-snug">
                                  {name}
                                </div>
                                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                  {item.categoryName?.trim() ? (
                                    <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-border bg-muted/60 px-1.5 text-[10px] font-medium leading-none">
                                      {item.categoryName.trim()}
                                    </span>
                                  ) : null}
                                  {sku ? (
                                    skuNeedsTooltip ? (
                                      <AppTooltip content={sku} asChild align="start">
                                        <span className="min-w-0 cursor-default truncate leading-none">
                                          SKU: {truncatedSku}
                                        </span>
                                      </AppTooltip>
                                    ) : (
                                      <span className="min-w-0 truncate leading-none">
                                        SKU: {truncatedSku}
                                      </span>
                                    )
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="w-[32%] min-w-[10rem] px-3 py-3 align-top text-muted-foreground">
                              {notesText ? (
                                <span className="block break-words whitespace-normal leading-snug">
                                  {notesText}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-3 text-sm">
                              {item.unitName?.trim() || "—"}
                            </td>
                            <td className="px-3 py-3 text-right font-mono tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-3 text-right font-mono tabular-nums">
                              {fmtGBP(unitPrice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/50">
                        <td colSpan={4} className="px-4 py-3 sm:px-6">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                              <Calculator className="h-3.5 w-3.5" aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">Total</div>
                              <div className="text-xs text-muted-foreground">
                                {items.length} item{items.length === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <AppTooltip content={fmtGBP(viewTotalPrice)} asChild align="end">
                            <div className="font-display text-base font-semibold tabular-nums tracking-tight text-foreground sm:text-lg">
                              {fmtGBP(viewTotalPrice)}
                            </div>
                          </AppTooltip>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
        </>
      )}

      {confirmDel && canDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmDel(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Delete {row.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the trade group and its items.
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
                Delete trade group
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}