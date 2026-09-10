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
import { ProjectFormFields } from "@/components/projects/ProjectFormFields";
import { Button } from "@/components/ui/button";
import { AlertCircle, FolderKanban, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { projectsService, type ApiProject } from "@/lib/api/services/projects";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { projectsQueryKey } from "./projects.index";
import { CodeBadge, CodeWithLabel } from "@/components/CodeBadge";
import { RoleCodeBadge } from "@/components/RoleCodeBadge";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { PROJECTS_ROUTE } from "@/lib/projects";
import {
  emptyProjectFormValues,
  projectAssigneeLabels,
  projectFormSchema,
  projectToFormValues,
  toProjectPayload,
  type ProjectFormValues,
} from "@/lib/project-form";
import { parseAssignableStaffLabel } from "@/lib/project-assignee";
import { useRateCapReasonGate } from "@/components/rates/useRateCapReasonGate";
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

export const Route = createFileRoute("/projects/$id")({
  head: () => ({ meta: [{ title: "Project | Schore" }] }),
  validateSearch: detailSearchSchema,
  component: ProjectDetail,
});

function projectHighlights(row: ApiProject): DetailProfileHighlight[] {
  const assignedUsers = row.assignedUsers ?? [];
  const assigned =
    assignedUsers.length === 0 ? (
      "—"
    ) : (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {assignedUsers.map((user) => {
          const parsed = parseAssignableStaffLabel(user.name ?? "");
          return (
            <span key={user.id} className="inline-flex items-center gap-1">
              <span>{parsed.label || user.name}</span>
              <RoleCodeBadge code={parsed.code} />
            </span>
          );
        })}
      </span>
    );
  return [
    { label: "Code", value: <CodeBadge code={row.code} /> },
    { label: "Client", value: <CodeWithLabel combined={row.customerName} /> },
    { label: "Site", value: row.siteName?.trim() || "—" },
    { label: "Assign To", value: assigned },
  ];
}

function ProjectDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { mode } = search;
  const returnContext = parseHierarchyReturnSearch(search);
    const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: PROJECTS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: PROJECTS_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;
  const { runWithCapReason, modal: capReasonModal } = useRateCapReasonGate();

  const backLabel = hierarchyBackLabel(returnContext, "Back to projects");
  const goBack = () => navigate(hierarchyBackNavigation(returnContext, "/projects"));

  function openEdit() {
    navigate({
      to: "/projects/$id",
      params: { id },
      search: returnContext ? hierarchyEntityEditSearch(returnContext) : { mode: "edit" },
      replace: true,
    });
  }

  const projectQuery = useQuery({
    queryKey: ["projects", id],
    queryFn: async () => (await projectsService.get(id)).data,
  });
  const row = projectQuery.data;

  const defaults = useMemo<ProjectFormValues>(
    () =>
      row
        ? projectToFormValues(row)
        : emptyProjectFormValues,
    [row],
  );

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!row) return;
    form.reset(defaults);
  }, [row, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toProjectPayload>) =>
      projectsService.update(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Project updated");
      queryClient.setQueryData(["projects", id], res.data);
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      if (returnContext) {
        goBack();
        return;
      }
      navigate({ to: "/projects/$id", params: { id } });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Project deleted");
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      navigate({ to: "/projects" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete project"),
  });

  async function save(values: ProjectFormValues) {
    try {
      await runWithCapReason(values, (next) => updateMutation.mutateAsync(toProjectPayload(next)));
    } catch (err) {
      notifyApiError(err, "Failed to update project");
    }
  }

  if (projectQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading project…
      </div>
    );
  }

  if (projectQuery.isError || !row) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(projectQuery.error as unknown as ApiError)?.message ||
            "This project may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/projects">Back to projects</Link>
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
          Edit project
        </Button>
      )}
      <Can route={PROJECTS_ROUTE} action="delete">
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
            title="Edit project"
            onBack={returnContext ? { label: backLabel, onClick: goBack } : undefined}
            back={
              returnContext
                ? undefined
                : { to: "/projects/$id", params: { id }, label: "Back to project" }
            }
            headerActions={<SwitchField<ProjectFormValues> name="isActive" label="Active" />}
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
                        : navigate({ to: "/projects/$id", params: { id } })
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
            <ProjectFormFields
              customerSelectedLabel={row.customerName}
              siteSelectedLabel={row.siteName}
              assigneeSelectedLabels={projectAssigneeLabels(row.assignedUsers)}
            />
          </FormPageCard>
        </Form>
      ) : (
        <>
          <DetailProfileHero
            className="w-full"
            title="Project details"
            backLabel={returnContext ? undefined : backLabel}
            backTo={returnContext ? undefined : "/projects"}
            onBack={returnContext ? { label: backLabel, onClick: goBack } : undefined}
            headerActions={viewActions}
            leading={
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-background bg-accent/90 text-accent-foreground shadow-sm sm:h-12 sm:w-12">
                <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
              </span>
            }
            name={row.name}
            status={<ActiveStatusBadge isActive={row.isActive} />}
            highlights={projectHighlights(row)}
          >
            {row.description?.trim() ? (
              <DetailField label="Description" value={row.description} />
            ) : null}
          </DetailProfileHero>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
            <div className="min-w-0 lg:col-span-2">
              <EntityHierarchyCard
                scope="project"
                projectId={row.id}
                projectLabel={row.name}
                siteId={row.siteId}
                siteLabel={row.siteName ?? undefined}
                customerId={row.customerId}
                customerLabel={row.customerName ?? undefined}
              />
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
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the project record.
            </p>
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
                Delete project
              </Button>
            </div>
          </div>
        </div>
      )}
      {capReasonModal}
    </div>
  );
}
