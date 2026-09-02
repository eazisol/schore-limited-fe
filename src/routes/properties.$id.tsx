import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormPageCard } from "@/components/FormPageCard";
import { DetailField } from "@/components/DetailField";
import {
  DetailProfileHero,
  type DetailProfileHighlight,
} from "@/components/DetailProfileHero";
import { Button } from "@/components/ui/button";
import { AlertCircle, Building2, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { propertiesService, type ApiProperty } from "@/lib/api/services/properties";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { propertiesQueryKey } from "./properties.index";
import { CodeBadge, CodeWithLabel } from "@/components/CodeBadge";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { PROPERTIES_ROUTE } from "@/lib/properties";
import { formatDetailAddress } from "@/lib/module-ui";
import {
  propertyFormSchema,
  toPropertyPayload,
  type PropertyFormValues,
} from "@/lib/property-form";
import { PropertyFormFields } from "@/components/properties/PropertyFormFields";
import { PropertyTasksCard } from "@/components/properties/PropertyTasksCard";
import {
  hierarchyBackLabel,
  hierarchyBackNavigation,
  hierarchyEntityEditSearch,
  hierarchyReturnSearchSchema,
  parseHierarchyReturnSearch,
} from "@/lib/hierarchy-navigation";

const detailSearchSchema = z
  .object({
    mode: z.enum(["edit", "view"]).optional(),
  })
  .merge(hierarchyReturnSearchSchema);

export const Route = createFileRoute("/properties/$id")({
  head: ({ params }) => ({ meta: [{ title: `Property #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: PropertyDetail,
});

function propertyLocation(row: ApiProperty): string | undefined {
  const address = formatDetailAddress(row);
  return address === "—" ? undefined : address;
}

function propertyHighlights(row: ApiProperty): DetailProfileHighlight[] {
  const items: DetailProfileHighlight[] = [];
  if (row.reference?.trim()) {
    items.push({ label: "Reference", value: <CodeBadge code={row.reference.trim()} /> });
  }
  items.push({ label: "Client", value: <CodeWithLabel combined={row.customerName} /> });
  items.push({ label: "Site", value: row.siteName?.trim() || "—" });
  items.push({ label: "Project", value: row.projectName?.trim() || "—" });
  items.push({ label: "Contact", value: row.contactName?.trim() || "—" });
  return items;
}

function PropertyDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { mode } = search;
  const returnContext = parseHierarchyReturnSearch(search);
    const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: PROPERTIES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: PROPERTIES_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;

  const backLabel = hierarchyBackLabel(returnContext, "Back to properties");
  const goBack = () => navigate(hierarchyBackNavigation(returnContext, "/properties"));

  function openEdit() {
    navigate({
      to: "/properties/$id",
      params: { id },
      search: returnContext ? hierarchyEntityEditSearch(returnContext) : { mode: "edit" },
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
      siteId: row?.siteId != null ? String(row.siteId) : "",
      projectId: row?.projectId != null ? String(row.projectId) : "",
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
      propertiesService.update(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Property updated");
      queryClient.setQueryData(["properties", id], res.data);
      queryClient.invalidateQueries({ queryKey: propertiesQueryKey });
      if (returnContext) {
        goBack();
        return;
      }
      navigate({ to: "/properties/$id", params: { id } });
    },
    onError: (err) => notifyApiError(err, "Failed to update property"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => propertiesService.remove(id),
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
  const viewActions = (
    <>
      {canModify && (
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
  );

  return (
    <div className="space-y-6">
      {isEditing ? (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Form form={form} onSubmit={save} className="lg:col-span-2">
            <FormPageCard
              title="Edit property"
              onBack={returnContext ? { label: backLabel, onClick: goBack } : undefined}
              back={returnContext ? undefined : { to: "/properties", label: backLabel }}
              headerActions={<SwitchField<PropertyFormValues> name="isActive" label="Active" />}
              maxWidth="w-full max-w-none"
              footer={
                <>
                  <span className="text-xs text-muted-foreground sm:mr-auto">
                    {dirty ? "Unsaved changes" : "All changes saved"}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        returnContext
                          ? goBack()
                          : navigate({ to: "/properties/$id", params: { id } })
                      }
                    >
                      Cancel
                    </Button>
                    <SubmitButton size="sm" disabled={!dirty} loadingText="Saving…">
                      Save changes
                    </SubmitButton>
                  </div>
                </>
              }
            >
              <PropertyFormFields
                embedded
                disabled={updateMutation.isPending}
                customerSelectedLabel={row.customerName}
                siteSelectedLabel={row.siteName}
                projectSelectedLabel={row.projectName}
              />
            </FormPageCard>
          </Form>
      </div>
      ) : (
        <>
          <DetailProfileHero
            className="w-full"
            title="Property details"
            backLabel={returnContext ? undefined : backLabel}
            backTo={returnContext ? undefined : "/properties"}
            onBack={returnContext ? { label: backLabel, onClick: goBack } : undefined}
            headerActions={viewActions}
            leading={
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-background bg-accent/90 text-accent-foreground shadow-sm sm:h-12 sm:w-12">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
              </span>
            }
            name={row.propertyName}
            location={propertyLocation(row)}
            status={<ActiveStatusBadge isActive={row.isActive} />}
            email={row.contactEmail}
            phone={row.contactPhoneNo}
            highlights={propertyHighlights(row)}
          >
            {row.accessNotes?.trim() ? (
              <DetailField label="Access notes" value={row.accessNotes} />
            ) : null}
          </DetailProfileHero>

          <PropertyTasksCard propertyId={row.id} propertyName={row.propertyName} />
        </>
      )}

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
