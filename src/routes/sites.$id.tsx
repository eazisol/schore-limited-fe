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
import { EntityHierarchyCard } from "@/components/hierarchy/EntityHierarchyCard";
import { SiteFormFields } from "@/components/sites/SiteFormFields";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { sitesService, type ApiSite } from "@/lib/api/services/sites";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { sitesQueryKey } from "./sites.index";
import { CodeBadge, CodeWithLabel } from "@/components/CodeBadge";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { SITES_ROUTE } from "@/lib/sites";
import { formatDetailAddress } from "@/lib/module-ui";
import {
  siteFormSchema,
  siteToFormValues,
  toSitePayload,
  type SiteFormValues,
} from "@/lib/site-form";

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

export const Route = createFileRoute("/sites/$id")({
  head: ({ params }) => ({ meta: [{ title: `Site #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: SiteDetail,
});

function siteLocation(row: ApiSite): string | undefined {
  const address = formatDetailAddress(row);
  return address === "—" ? undefined : address;
}

function siteHighlights(row: ApiSite): DetailProfileHighlight[] {
  return [
    { label: "Code", value: <CodeBadge code={row.code} /> },
    { label: "Client", value: <CodeWithLabel combined={row.customerName} /> },
  ];
}

function SiteDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { mode } = search;
  const returnContext = parseHierarchyReturnSearch(search);
    const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: SITES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: SITES_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;

  const backLabel = hierarchyBackLabel(returnContext, "Back to sites");
  const goBack = () => navigate(hierarchyBackNavigation(returnContext, "/sites"));

  function openEdit() {
    navigate({
      to: "/sites/$id",
      params: { id },
      search: returnContext ? hierarchyEntityEditSearch(returnContext) : { mode: "edit" },
      replace: true,
    });
  }

  const siteQuery = useQuery({
    queryKey: ["sites", id],
    queryFn: async () => (await sitesService.get(id)).data,
  });
  const row = siteQuery.data;

  const defaults = useMemo<SiteFormValues>(
    () => (row ? siteToFormValues(row) : siteToFormValues({
      name: "",
      code: "",
      customerId: "",
      isActive: true,
    })),
    [row],
  );

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!row) return;
    form.reset(defaults);
  }, [row, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toSitePayload>) =>
      sitesService.update(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Site updated");
      queryClient.setQueryData(["sites", id], res.data);
      queryClient.invalidateQueries({ queryKey: sitesQueryKey });
      if (returnContext) {
        goBack();
        return;
      }
      navigate({ to: "/sites/$id", params: { id } });
    },
    onError: (err) => notifyApiError(err, "Failed to update site"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => sitesService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Site deleted");
      queryClient.invalidateQueries({ queryKey: sitesQueryKey });
      navigate({ to: "/sites" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete site"),
  });

  async function save(values: SiteFormValues) {
    await updateMutation.mutateAsync(toSitePayload(values));
  }

  if (siteQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading site…
      </div>
    );
  }

  if (siteQuery.isError || !row) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load site</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(siteQuery.error as unknown as ApiError)?.message || "This site may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/sites">Back to sites</Link>
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
          Edit site
        </Button>
      )}
      <Can route={SITES_ROUTE} action="delete">
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
        <Form form={form} onSubmit={save}>
          <FormPageCard
            title="Edit site"
            onBack={returnContext ? { label: backLabel, onClick: goBack } : undefined}
            back={
              returnContext
                ? undefined
                : { to: "/sites/$id", params: { id }, label: "Back to site" }
            }
            headerActions={<SwitchField<SiteFormValues> name="isActive" label="Active" />}
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
                        : navigate({ to: "/sites/$id", params: { id } })
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
            <SiteFormFields customerSelectedLabel={row.customerName} />
          </FormPageCard>
        </Form>
      ) : (
        <>
          <DetailProfileHero
            className="w-full"
            title="Site details"
            backLabel={returnContext ? undefined : backLabel}
            backTo={returnContext ? undefined : "/sites"}
            onBack={returnContext ? { label: backLabel, onClick: goBack } : undefined}
            headerActions={viewActions}
            leading={
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-background bg-accent/90 text-accent-foreground shadow-sm sm:h-12 sm:w-12">
                <MapPin className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
              </span>
            }
            name={row.name}
            location={siteLocation(row)}
            status={<ActiveStatusBadge isActive={row.isActive} />}
            highlights={siteHighlights(row)}
          >
            {row.description?.trim() ? (
              <DetailField label="Description" value={row.description} />
            ) : null}
          </DetailProfileHero>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
            <div className="min-w-0 lg:col-span-2">
              <EntityHierarchyCard scope="site" siteId={row.id} customerId={row.customerId} />
            </div>
          </div>
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
            <h3 className="font-display text-lg font-semibold">Delete {row.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">This permanently removes the site record.</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDel(false)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete site
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
