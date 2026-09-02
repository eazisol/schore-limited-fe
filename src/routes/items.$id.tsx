import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DetailProfileHero,
  type DetailProfileHighlight,
} from "@/components/DetailProfileHero";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Can, usePermission } from "@/components/Permission";
import { TableImagePreview } from "@/components/TableImagePreview";
import { productsService, resolveProductImageUrl } from "@/lib/api/services/products";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { itemsQueryKey } from "./items.index";
import { CodeBadge } from "@/components/CodeBadge";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { formatGbp } from "@/lib/module-ui";
import { ITEMS_ROUTE } from "@/lib/items";

export const Route = createFileRoute("/items/$id")({
  head: () => ({ meta: [{ title: "Item | Schore" }] }),
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
    mutationFn: () => productsService.remove(id),
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

  const imageSrc = resolveProductImageUrl(item.imageUrl, item.editDate);
  const subtitle = [item.categoryName?.trim(), item.productTypeName?.trim()]
    .filter(Boolean)
    .join(" · ");

  const highlights: DetailProfileHighlight[] = [
    { label: "SKU", value: <CodeBadge code={item.sku} /> },
    { label: "Unit", value: item.unitName?.trim() || "—" },
    { label: "Sale price", value: formatGbp(item.salePrice) },
    { label: "Cost price", value: formatGbp(item.costPrice) },
  ];

  const viewActions = (
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
  );

  return (
    <div className="space-y-6">
      <DetailProfileHero
        className="w-full"
        title="Item details"
        backLabel="Back to items"
        backTo="/items"
        headerActions={viewActions}
        leading={
          imageSrc ? (
            <TableImagePreview
              src={imageSrc}
              alt={item.name}
              tooltip="View image"
              className="h-11 w-11 rounded-lg border-2 border-background shadow-sm sm:h-12 sm:w-12"
            />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-background bg-accent/90 text-accent-foreground shadow-sm sm:h-12 sm:w-12">
              <Package className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
            </span>
          )
        }
        name={item.name}
        subtitle={subtitle || undefined}
        status={<ActiveStatusBadge isActive={item.isActive} />}
        description={item.description?.trim() || undefined}
        highlights={highlights}
      />

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
