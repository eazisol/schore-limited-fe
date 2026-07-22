import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { cisService } from "@/lib/api/services/cis";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { cisQueryKey } from "./cis-management.index";
import { activeStatusClass, formatDateTime, formatCisRate } from "@/lib/module-ui";
import { CIS_ROUTE } from "@/lib/cis";
import { cisFormSchema, toCisPayload, type CisFormValues } from "@/lib/cis-form";
import { CisFormFields } from "@/components/cis/CisFormFields";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/cis-management/$id")({
  head: ({ params }) => ({ meta: [{ title: `CIS #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: CisDetail,
});

function CisDetail() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: CIS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: CIS_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;

  function openEdit() {
    navigate({
      to: "/cis-management/$id",
      params: { id },
      search: { mode: "edit" },
      replace: true,
    });
  }

  const cisQuery = useQuery({
    queryKey: ["cis", id],
    queryFn: async () => (await cisService.get(id)).data,
  });
  const row = cisQuery.data;

  const defaults = useMemo<CisFormValues>(
    () => ({
      name: row?.name ?? "",
      code: row?.code ?? "",
      rate: row?.rate ?? 0,
      description: row?.description ?? "",
      orderBy: row?.orderBy ?? 0,
      isActive: row?.isActive ?? true,
    }),
    [row],
  );

  const form = useForm<CisFormValues>({
    resolver: zodResolver(cisFormSchema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (!row) return;
    form.reset(defaults);
  }, [row, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toCisPayload>) =>
      cisService.update(numericId, payload),
    onSuccess: (res) => {
      toast.success(res.message || "CIS status updated");
      queryClient.setQueryData(["cis", id], res.data);
      queryClient.invalidateQueries({ queryKey: cisQueryKey });
      navigate({ to: "/cis-management" });
    },
    onError: (err) => notifyApiError(err, "Failed to update CIS status"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => cisService.remove(numericId),
    onSuccess: (res) => {
      toast.success(res.message || "CIS status deleted");
      queryClient.invalidateQueries({ queryKey: cisQueryKey });
      navigate({ to: "/cis-management" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete CIS status"),
  });

  async function save(values: CisFormValues) {
    await updateMutation.mutateAsync(toCisPayload(values));
  }

  if (cisQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading CIS status…
      </div>
    );
  }

  if (cisQuery.isError || !row) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load CIS status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(cisQuery.error as unknown as ApiError)?.message ||
            "This CIS status may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/cis-management">Back to CIS management</Link>
        </Button>
      </div>
    );
  }

  const dirty = form.formState.isDirty;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? "Edit CIS status" : "CIS status details"}
        leading={
          <AppTooltip content="Back to CIS management" asChild>
            <Link
              to="/cis-management"
              aria-label="Back to CIS management"
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
                Edit CIS status
              </Button>
            )}
            <Can route={CIS_ROUTE} action="delete">
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
          <Form form={form} onSubmit={save} className="card-elevated space-y-4 p-6 lg:col-span-2">
            <h3 className="font-display font-semibold">Edit details</h3>
            <CisFormFields disabled={updateMutation.isPending} />
            <div className="flex items-center justify-end gap-2 border-t pt-2">
              <span className="mr-auto text-xs text-muted-foreground">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => navigate({ to: "/cis-management" })}
              >
                Cancel
              </Button>
              <SubmitButton disabled={!dirty} loadingText="Saving…">
                Save changes
              </SubmitButton>
            </div>
          </Form>
        ) : (
          <div className="card-elevated space-y-4 p-6 lg:col-span-2">
            <h3 className="font-display font-semibold">CIS details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="Name" value={row.name} />
                <ReadOnlyField label="Code" value={row.code} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="Rate" value={formatCisRate(row.rate)} />
                <ReadOnlyField label="Order" value={String(row.orderBy ?? 0)} />
              </div>
              <ReadOnlyField
                label="Status"
                value={
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(row.isActive)}`}
                  >
                    {row.isActive ? "Active" : "Inactive"}
                  </span>
                }
              />
              <ReadOnlyField label="Description" value={row.description || "—"} />
            </div>
          </div>
        )}

        <div className="card-elevated self-start p-6">
          <h3 className="mb-4 font-display font-semibold">Record</h3>
          <dl className="space-y-3 text-sm">
            <Row label="CIS ID">{row.id}</Row>
            <Row label="Created">{formatDateTime(row.createdDate)}</Row>
            <Row label="Last edited">{formatDateTime(row.editDate)}</Row>
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
            <h3 className="font-display text-lg font-semibold">Delete {row.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the CIS status. Operatives using it may need reassignment.
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
                Delete CIS status
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}
