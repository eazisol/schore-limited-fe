import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { DetailField, DetailMetaRow } from "@/components/DetailField";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { propertiesService } from "@/lib/api/services/properties";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { propertiesQueryKey } from "./properties.index";
import { activeStatusClass, formatDateTime } from "@/lib/module-ui";
import { PROPERTIES_ROUTE } from "@/lib/properties";
import {
  propertyFormSchema,
  toPropertyPayload,
  type PropertyFormValues,
} from "@/lib/property-form";
import { PropertyFormFields } from "@/components/properties/PropertyFormFields";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/properties/$id")({
  head: ({ params }) => ({ meta: [{ title: `Property #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: PropertyDetail,
});

function PropertyDetail() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: PROPERTIES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: PROPERTIES_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;

  function openEdit() {
    navigate({
      to: "/properties/$id",
      params: { id },
      search: { mode: "edit" },
      replace: true,
    });
  }

  const propertyQuery = useQuery({
    queryKey: ["properties", id],
    queryFn: async () => (await propertiesService.get(id)).data,
  });
  const row = propertyQuery.data;

  const defaults = useMemo<PropertyFormValues>(
    () => ({
      reference: row?.reference ?? "",
      propertyName: row?.propertyName ?? "",
      contactName: row?.contactName ?? "",
      contactPhoneNo: row?.contactPhoneNo ?? "",
      contactEmail: row?.contactEmail ?? "",
      address: row?.address ?? "",
      zipCode: row?.zipCode ?? "",
      city: row?.city ?? "",
      state: row?.state ?? "",
      country: row?.country ?? "",
      accessNotes: row?.accessNotes ?? "",
      customerId: row?.customerId != null ? String(row.customerId) : "",
      contractorId: row?.contractorId != null ? String(row.contractorId) : "",
      isActive: row?.isActive ?? true,
    }),
    [row],
  );

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (!row) return;
    form.reset(defaults);
  }, [row, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPropertyPayload>) =>
      propertiesService.update(numericId, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Property updated");
      queryClient.setQueryData(["properties", id], res.data);
      queryClient.invalidateQueries({ queryKey: propertiesQueryKey });
      navigate({ to: "/properties" });
    },
    onError: (err) => notifyApiError(err, "Failed to update property"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => propertiesService.remove(numericId),
    onSuccess: (res) => {
      toast.success(res.message || "Property deleted");
      queryClient.invalidateQueries({ queryKey: propertiesQueryKey });
      navigate({ to: "/properties" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete property"),
  });

  async function save(values: PropertyFormValues) {
    await updateMutation.mutateAsync(toPropertyPayload(values));
  }

  if (propertyQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading property…
      </div>
    );
  }

  if (propertyQuery.isError || !row) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load property</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(propertyQuery.error as unknown as ApiError)?.message ||
            "This property may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/properties">Back to properties</Link>
        </Button>
      </div>
    );
  }

  const dirty = form.formState.isDirty;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? "Edit property" : "Property details"}
        subtitle={!isEditing ? row.reference : undefined}
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
        actions={
          <>
            {!isEditing && canModify && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
                Edit property
              </Button>
            )}
            <Can route={PROPERTIES_ROUTE} action="delete">
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
        {isEditing ? (
          <Form form={form} onSubmit={save} className="space-y-6 lg:col-span-2">
            <PropertyFormFields
              disabled={updateMutation.isPending}
              customerSelectedLabel={row.customerName}
              contractorSelectedLabel={row.contractorName}
            />
            <div className="flex flex-col-reverse gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:pt-2">
              <span className="text-xs text-muted-foreground sm:mr-auto">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={() => navigate({ to: "/properties" })}
                >
                  Cancel
                </Button>
                <SubmitButton disabled={!dirty} loadingText="Saving…">
                  Save changes
                </SubmitButton>
              </div>
            </div>
          </Form>
        ) : (
          <div className="card-elevated space-y-5 p-4 sm:p-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label="Reference" value={row.reference} />
              <DetailField label="Property name" value={row.propertyName} />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label="Contact name" value={row.contactName} />
              <DetailField label="Contact phone" value={row.contactPhoneNo || "—"} />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label="Contact email" value={row.contactEmail || "—"} />
              <DetailField
                label="Status"
                value={
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(row.isActive)}`}
                  >
                    {row.isActive ? "Active" : "Inactive"}
                  </span>
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label="Customer" value={row.customerName || "—"} />
              <DetailField label="Contractor" value={row.contractorName || "—"} />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label="Address" value={row.address || "—"} />
              <DetailField label="Zip code" value={row.zipCode || "—"} />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label="City" value={row.city || "—"} />
              <DetailField label="State" value={row.state || "—"} />
            </div>
            <DetailField label="Country" value={row.country || "—"} />
            <DetailField label="Access notes" value={row.accessNotes || "—"} />
          </div>
        )}

        <div className="card-elevated self-start p-6">
          <h3 className="mb-4 font-display font-semibold">Record</h3>
          <dl className="space-y-3">
            <DetailMetaRow label="Property ID">{row.id}</DetailMetaRow>
            <DetailMetaRow label="Created">{formatDateTime(row.createdDate)}</DetailMetaRow>
            <DetailMetaRow label="Last edited">{formatDateTime(row.editDate)}</DetailMetaRow>
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
            <h3 className="font-display text-lg font-semibold">Delete {row.propertyName}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the property record.
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
                Delete property
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
