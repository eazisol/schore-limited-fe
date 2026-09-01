import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormPageCard } from "@/components/FormPageCard";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton, SwitchField } from "@/components/form";
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
      <Form form={form} onSubmit={submit} className="max-w-4xl">
        <FormPageCard
          title="Add item"
          back={{ to: "/items", label: "Back to items" }}
          headerActions={<SwitchField<ItemFormValues> name="isActive" label="Active" />}
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/items" })}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <SubmitButton size="sm" loadingText="Saving…">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Create item
              </SubmitButton>
            </div>
          }
        >
          <ItemFormFields onImageFileChange={setImageFile} />
        </FormPageCard>
      </Form>
    </RequirePermission>
  );
}
