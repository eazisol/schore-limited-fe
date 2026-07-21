import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { productsService } from "@/lib/api/services/products";
import { notifyApiError } from "@/lib/api/axios";
import { itemsQueryKey } from "./items.index";
import { ITEMS_ROUTE } from "@/lib/items";
import {
  itemFormDefaults,
  itemFormSchema,
  toProductPayload,
  type ItemFormValues,
} from "@/lib/item-form";
import { ItemFormFields } from "@/components/items/ItemFormFields";

export const Route = createFileRoute("/items/new")({
  head: () => ({ meta: [{ title: "Add Item | Schore" }] }),
  component: NewItem,
});

function NewItem() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: itemFormDefaults,
  });

  const createMutation = useMutation({
    mutationFn: ({
      payload,
      file,
    }: {
      payload: ReturnType<typeof toProductPayload>;
      file: File | null;
    }) => productsService.create(payload, file),
    onSuccess: (res) => {
      toast.success(res.message || `${res.data?.name || "Item"} created`);
      queryClient.invalidateQueries({ queryKey: itemsQueryKey });
      navigate({ to: "/items" });
    },
    onError: (err) => notifyApiError(err, "Failed to create item"),
  });

  async function submit(values: ItemFormValues) {
    await createMutation.mutateAsync({
      payload: toProductPayload(values),
      file: imageFile,
    });
  }

  return (
    <RequirePermission route={ITEMS_ROUTE} action="modify">
      <div>
        <PageHeader
          title="Add Item"
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

        <Form form={form} onSubmit={submit} className="max-w-3xl space-y-6">
          <div className="card-elevated space-y-4 p-6">
            <h3 className="font-display font-semibold">Item details</h3>
            <ItemFormFields onImageFileChange={setImageFile} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/items" })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton loadingText="Saving…">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create item
            </SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
