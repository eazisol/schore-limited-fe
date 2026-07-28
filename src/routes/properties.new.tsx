import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton } from "@/components/form";
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
      <div>
        <PageHeader
          title="Add property"
          leading={
            <AppTooltip content="Back to properties" asChild>
              <Link
                to="/properties"
                aria-label="Back to properties"
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
          }
        />

        <Form form={form} onSubmit={submit} className="max-w-4xl space-y-6">
          <PropertyFormFields disabled={createMutation.isPending} autoFocusReference />

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/properties" })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton loadingText="Saving…">Create property</SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
