import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import {
  productsService,
  resolveProductImageUrl,
} from "@/lib/api/services/products";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { itemsQueryKey } from "./items.index";
import { ITEMS_ROUTE } from "@/lib/items";
import {
  itemFormSchema,
  toProductPayload,
  type ItemFormValues,
} from "@/lib/item-form";
import { ItemFormFields } from "@/components/items/ItemFormFields";

export const Route = createFileRoute("/items/$id/edit")({
  head: ({ params }) => ({ meta: [{ title: `Edit Item #${params.id} | Schore` }] }),
  component: EditItem,
});

function EditItem() {
  const { id } = Route.useParams();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);

  const itemQuery = useQuery({
    queryKey: ["items", id],
    queryFn: async () => (await productsService.get(id)).data,
  });
  const item = itemQuery.data;

  const defaults = useMemo<ItemFormValues>(
    () => ({
      name: item?.name ?? "",
      description: item?.description ?? "",
      sku: item?.sku ?? "",
      productTypeId: item?.productTypeId != null ? String(item.productTypeId) : "",
      categoryId: item?.categoryId != null ? String(item.categoryId) : "",
      unitId: item?.unitId != null ? String(item.unitId) : "",
      salePrice: item?.salePrice ?? 0,
      costPrice: item?.costPrice ?? 0,
      imageUrl: resolveProductImageUrl(item?.imageUrl, item?.editDate),
      isActive: item?.isActive ?? true,
    }),
    [item],
  );

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!item) return;
    form.reset(defaults);
    setImageFile(null);
  }, [item, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: ({
      payload,
      file,
    }: {
      payload: ReturnType<typeof toProductPayload>;
      file: File | null;
    }) => productsService.update(numericId, payload, file),
    onSuccess: (res) => {
      toast.success(res.message || "Item updated");
      queryClient.setQueryData(["items", id], res.data);
      queryClient.invalidateQueries({ queryKey: itemsQueryKey });
      navigate({ to: "/items/$id", params: { id } });
    },
    onError: (err) => notifyApiError(err, "Failed to update item"),
  });

  async function save(values: ItemFormValues) {
    await updateMutation.mutateAsync({
      payload: toProductPayload(values),
      file: imageFile,
    });
  }

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

  const dirty = form.formState.isDirty || imageFile != null;

  return (
    <RequirePermission route={ITEMS_ROUTE} action="modify">
      <div className="space-y-6">
        <PageHeader
          title="Edit item"
          leading={
            <AppTooltip content="Back to item" asChild>
              <Link
                to="/items/$id"
                params={{ id }}
                aria-label="Back to item"
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
          }
        />

        <Form form={form} onSubmit={save} className="card-elevated max-w-3xl space-y-4 p-6">
          <h3 className="font-display font-semibold">Edit details</h3>
          <fieldset className="space-y-4">
            <ItemFormFields
              selectedLabels={{
                productType: item.productTypeName,
                category: item.categoryName,
                unit: item.unitName,
              }}
              onImageFileChange={setImageFile}
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
              onClick={() => navigate({ to: "/items/$id", params: { id } })}
            >
              Cancel
            </Button>
            <SubmitButton disabled={!dirty} loadingText="Saving…">
              Save changes
            </SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
