import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormPageCard } from "@/components/FormPageCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { propertiesService } from "@/lib/api/services/properties";
import { notifyApiError } from "@/lib/api/axios";
import { propertiesQueryKey } from "./properties.index";
import { PROPERTIES_ROUTE } from "@/lib/properties";
import {
  propertyFormDefaults,
  propertyFormSchema,
  toPropertyPayload,
  type PropertyFormValues,
} from "@/lib/property-form";
import { PropertyFormFields } from "@/components/properties/PropertyFormFields";

export const Route = createFileRoute("/properties/new")({
  head: () => ({ meta: [{ title: "Add Property | Schore" }] }),
  component: NewProperty,
});

function NewProperty() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: propertyFormDefaults,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPropertyPayload>) => propertiesService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `${res.data?.propertyName || "Property"} created`);
      queryClient.invalidateQueries({ queryKey: propertiesQueryKey });
      navigate({ to: "/properties" });
    },
    onError: (err) => notifyApiError(err, "Failed to create property"),
  });

  async function submit(values: PropertyFormValues) {
    await createMutation.mutateAsync(toPropertyPayload(values));
  }

  return (
    <RequirePermission route={PROPERTIES_ROUTE} action="modify">
      <Form form={form} onSubmit={submit} className="max-w-4xl">
        <FormPageCard
          title="Add property"
          back={{ to: "/properties", label: "Back to properties" }}
          headerActions={<SwitchField<PropertyFormValues> name="isActive" label="Active" />}
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/properties" })}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <SubmitButton size="sm" loadingText="Saving…">
                Create property
              </SubmitButton>
            </div>
          }
        >
          <PropertyFormFields disabled={createMutation.isPending} embedded autoFocusPropertyName />
        </FormPageCard>
      </Form>
    </RequirePermission>
  );
}
