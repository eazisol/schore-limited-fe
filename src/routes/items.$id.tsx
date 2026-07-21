import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Can, usePermission } from "@/components/Permission";
import { productsService, resolveProductImageUrl } from "@/lib/api/services/products";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { itemsQueryKey } from "./items.index";
import { activeStatusClass, formatDateTime, formatGbp } from "@/lib/module-ui";
import { ITEMS_ROUTE } from "@/lib/items";

export const Route = createFileRoute("/items/$id")({
  head: ({ params }) => ({ meta: [{ title: `Item #${params.id} | Schore` }] }),
  component: ItemDetailLayout,
});

function ItemDetailLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isEdit = pathname.endsWith("/edit");
  if (isEdit) return <Outlet />;
  return <ItemDetail />;
}

function ItemDetail() {
  const { id } = Route.useParams();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: ITEMS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: ITEMS_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);

  const itemQuery = useQuery({
    queryKey: ["items", id],
    queryFn: async () => (await productsService.get(id)).data,
  });
  const item = itemQuery.data;

  const deleteMutation = useMutation({
    mutationFn: () => productsService.remove(numericId),
    onSuccess: (res) => {
      toast.success(res.message || "Item deleted");
      queryClient.invalidateQueries({ queryKey: itemsQueryKey });
      navigate({ to: "/items" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete item"),
  });

  if (itemQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading item…
      </div>
    );
  }

  if (itemQuery.isError || !item) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load item</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(itemQuery.error as unknown as ApiError)?.message ||
            "This item may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/items">Back to items</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item details"
        leading={
          <AppTooltip content="Back to items" asChild>
            <Link
              to="/items"
              aria-label="Back to items"
              className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </AppTooltip>
        }
        actions={
          <>
            {canModify && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/items/$id/edit" params={{ id }}>
                  <Pencil className="h-4 w-4" />
                  Edit item
                </Link>
              </Button>
            )}
            <Can route={ITEMS_ROUTE} action="delete">
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
        <div className="card-elevated space-y-4 p-6 lg:col-span-2">
          <h3 className="font-display font-semibold">Item details</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReadOnlyField label="Name" value={item.name} />
            <ReadOnlyField label="SKU" value={item.sku} />
            <ReadOnlyField
              label="Status"
              value={
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(item.isActive)}`}
                >
                  {item.isActive ? "Active" : "Inactive"}
                </span>
              }
            />

            <ReadOnlyField label="Product type" value={item.productTypeName || "—"} />
            <ReadOnlyField label="Category" value={item.categoryName || "—"} />
            <ReadOnlyField label="Unit" value={item.unitName || "—"} />

            <ReadOnlyField label="Sale price" value={formatGbp(item.salePrice)} />
            <ReadOnlyField label="Cost price" value={formatGbp(item.costPrice)} />

            <ReadOnlyField
              label="Image"
              value={
                item.imageUrl ? (
                  <img
                    src={resolveProductImageUrl(item.imageUrl, item.editDate)}
                    alt=""
                    className="mt-0.5 h-24 w-full max-w-[10rem] rounded-md border object-cover"
                  />
                ) : (
                  "—"
                )
              }
            />

            <div className="sm:col-span-2 lg:col-span-3">
              <ReadOnlyField label="Description" value={item.description || "—"} />
            </div>
          </div>
        </div>

        <div className="card-elevated self-start p-6">
          <h3 className="mb-4 font-display font-semibold">Record</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Item ID">{item.id}</Row>
            <Row label="Created">{formatDateTime(item.createdDate)}</Row>
            <Row label="Last edited">{formatDateTime(item.editDate)}</Row>
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
            <h3 className="font-display text-lg font-semibold">Delete {item.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the item from the catalogue. This action cannot be undone.
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
                Delete item
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
    <div className="min-w-0 space-y-1">
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
