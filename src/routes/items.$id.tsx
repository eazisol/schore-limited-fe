import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { DetailField, DetailMetaRow, DetailSectionHeading } from "@/components/DetailField";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CirclePoundSterling,
  FileText,
  Folder,
  ImageIcon,
  Layers,
  Loader2,
  Package,
  Pencil,
  ScrollText,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Can, usePermission } from "@/components/Permission";
import { TableImagePreview } from "@/components/TableImagePreview";
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

  const imageSrc = resolveProductImageUrl(item.imageUrl, item.editDate);

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
        <div className="card-elevated space-y-5 p-4 sm:p-6 lg:col-span-2">
          <DetailSectionHeading>Item details</DetailSectionHeading>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailField icon={Package} label="Name" value={item.name} />
            <DetailField icon={Tag} label="SKU" value={item.sku} />
            <DetailField
              icon={BadgeCheck}
              label="Status"
              value={
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(item.isActive)}`}
                >
                  {item.isActive ? "Active" : "Inactive"}
                </span>
              }
            />
            <DetailField
              icon={Briefcase}
              label="Product type"
              value={item.productTypeName || "—"}
            />
            <DetailField icon={Folder} label="Category" value={item.categoryName || "—"} />
            <DetailField icon={Layers} label="Unit" value={item.unitName || "—"} />
            <DetailField
              icon={CirclePoundSterling}
              label="Sale price"
              value={formatGbp(item.salePrice)}
            />
            <DetailField
              icon={CirclePoundSterling}
              label="Cost price"
              value={formatGbp(item.costPrice)}
            />
            <div className="sm:col-span-2">
              <DetailField
                icon={ScrollText}
                label="Description"
                value={
                  <span className="whitespace-pre-wrap leading-relaxed">
                    {item.description?.trim() || "—"}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-elevated self-start p-4 sm:p-6">
            <DetailSectionHeading className="mb-4" icon={FileText}>
              Record
            </DetailSectionHeading>
            <dl className="space-y-3">
              <DetailMetaRow label="Item ID">{item.id}</DetailMetaRow>
              <DetailMetaRow label="Created">{formatDateTime(item.createdDate)}</DetailMetaRow>
              <DetailMetaRow label="Last edited">{formatDateTime(item.editDate)}</DetailMetaRow>
            </dl>
          </div>

          {imageSrc ? (
            <div className="card-elevated flex flex-col p-4 sm:p-6">
              <DetailSectionHeading className="mb-4" icon={ImageIcon}>
                Product image
              </DetailSectionHeading>
              <div className="flex items-center justify-center rounded-lg bg-muted/40 p-6">
                <TableImagePreview
                  src={imageSrc}
                  alt={item.name}
                  tooltip="View image"
                  className="h-40 w-40 sm:h-44 sm:w-44"
                />
              </div>
            </div>
          ) : null}
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
