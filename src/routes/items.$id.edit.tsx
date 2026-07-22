import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import {
  productsService,
  resolveProductImageUrl,
  type ApiProduct,
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
  const [confirmImageRemoval, setConfirmImageRemoval] = useState(false);

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
      navigate({ to: "/items" });
    },
    onError: (err) => notifyApiError(err, "Failed to update item"),
  });

  const removeImageMutation = useMutation({
    mutationFn: () => productsService.removeImage(numericId),
    onSuccess: (res) => {
      toast.success(res.message || "Image removed");
      setConfirmImageRemoval(false);
      setImageFile(null);
      form.setValue("imageUrl", "", { shouldDirty: false });
      queryClient.setQueryData(["items", id], (prev: ApiProduct | undefined) =>
        prev ? { ...prev, imageUrl: null } : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["items", id] });
      queryClient.invalidateQueries({ queryKey: itemsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to remove image"),
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
  const removingImage = removeImageMutation.isPending;

  return (
    <RequirePermission route={ITEMS_ROUTE} action="modify">
      <div className="space-y-6">
        <PageHeader
          title="Edit item"
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
        />

        <Form form={form} onSubmit={save} className="card-elevated max-w-3xl space-y-4 p-6">
          <h3 className="font-display font-semibold">Edit details</h3>
          <fieldset className="space-y-4" disabled={removingImage}>
            <ItemFormFields
              selectedLabels={{
                productType: item.productTypeName,
                category: item.categoryName,
                unit: item.unitName,
              }}
              onImageFileChange={setImageFile}
              onImageRemove={() => setConfirmImageRemoval(true)}
              imageDisabled={removingImage}
            />
          </fieldset>
          <div className="flex items-center justify-end gap-2 border-t pt-2">
            <span className="mr-auto text-xs text-muted-foreground">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={updateMutation.isPending || removingImage}
              onClick={() => navigate({ to: "/items" })}
            >
              Cancel
            </Button>
            <SubmitButton disabled={!dirty || removingImage} loadingText="Saving…">
              Save changes
            </SubmitButton>
          </div>
        </Form>

        {confirmImageRemoval && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
            onClick={() => !removingImage && setConfirmImageRemoval(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-item-image-title"
              className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="remove-item-image-title" className="font-display text-lg font-semibold">
                Remove image?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This will permanently remove the current item image.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={removingImage}
                  onClick={() => setConfirmImageRemoval(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={removingImage}
                  onClick={() => removeImageMutation.mutate()}
                >
                  {removingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Remove image
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
