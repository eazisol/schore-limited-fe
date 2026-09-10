import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CodeBadge, CodeWithLabel } from "@/components/CodeBadge";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/AppShell";
import { FormPageCard } from "@/components/FormPageCard";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton } from "@/components/form";
import { Can, RequirePermission, usePermission } from "@/components/Permission";
import { tasksService } from "@/lib/api/services/tasks";
import { propertiesService } from "@/lib/api/services/properties";
import { notifyApiError } from "@/lib/api/axios";
import { tasksQueryKey } from "./tasks.index";
import { TASKS_ROUTE } from "@/lib/tasks";
import { dailyQueryKey } from "./daily";
import type { ApiDailyProgramme } from "@/lib/api/services/daily-programme";
import {
  formatPriceDisplay,
  taskFormSchema,
  taskToFormValues,
  toTaskPayload,
  type TaskFormValues,
} from "@/lib/task-form";
import { TaskFormFields } from "@/components/tasks/TaskFormFields";
import { JobWorkCalendar } from "@/components/tasks/JobWorkCalendar";
import { formatDateTime } from "@/lib/module-ui";
import { z } from "zod";

const searchSchema = z.object({
  mode: z.enum(["view", "edit"]).optional().default("view"),
  from: z.enum(["daily", "customer", "property", "site", "project"]).optional(),
  customerId: z.string().optional(),
  propertyId: z.string().optional(),
  siteId: z.string().optional(),
  projectId: z.string().optional(),
});

export const Route = createFileRoute("/tasks/$id")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Job | Schore" }] }),
  component: TaskDetail,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const { mode, from, customerId, propertyId, siteId, projectId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const isEdit = mode === "edit" && canModify;
  const fromDaily = from === "daily";
  const fromCustomer = from === "customer" && Boolean(customerId);
  const fromProperty = from === "property" && Boolean(propertyId);
  const fromSite = from === "site" && Boolean(siteId);
  const fromProject = from === "project" && Boolean(projectId);
  const backLabel = fromDaily
    ? "Back to daily programmer"
    : fromCustomer
      ? "Back to client"
      : fromSite
        ? "Back to site"
        : fromProject
          ? "Back to project"
          : fromProperty
            ? "Back to property"
            : "Back to jobs";
  const contextSearch = fromDaily
    ? { from: "daily" as const }
    : fromCustomer
      ? { from: "customer" as const, customerId: String(customerId) }
      : fromSite
        ? { from: "site" as const, siteId: String(siteId) }
        : fromProject
          ? { from: "project" as const, projectId: String(projectId) }
          : fromProperty
            ? { from: "property" as const, propertyId: String(propertyId) }
            : undefined;

  const goBack = () => {
    if (fromDaily) {
      navigate({ to: "/daily" });
      return;
    }
    if (fromCustomer && customerId) {
      navigate({ to: "/customers/$id", params: { id: customerId } });
      return;
    }
    if (fromSite && siteId) {
      navigate({ to: "/sites/$id", params: { id: siteId } });
      return;
    }
    if (fromProject && projectId) {
      navigate({ to: "/projects/$id", params: { id: projectId } });
      return;
    }
    if (fromProperty && propertyId) {
      navigate({ to: "/properties/$id", params: { id: propertyId } });
      return;
    }
    navigate({ to: "/tasks" });
  };

  const {
    data: task,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...tasksQueryKey, id],
    queryFn: async () => (await tasksService.get(id)).data,
  });

  const propertyQuery = useQuery({
    queryKey: ["properties", task?.propertyId],
    enabled: Boolean(task?.propertyId),
    queryFn: async () => (await propertiesService.get(task!.propertyId)).data,
    staleTime: 60_000,
  });

  /** Prefer task API fields; fall back to property (and daily cache) so list values always show. */
  const customerDisplay = (() => {
    const fromTask = task?.contract?.trim();
    if (fromTask) return fromTask;
    const fromProperty = propertyQuery.data?.customerName?.trim();
    if (fromProperty) return fromProperty;
    if (task && fromDaily) {
      const caches = queryClient.getQueriesData<ApiDailyProgramme>({ queryKey: dailyQueryKey });
      for (const [, programme] of caches) {
        const row = programme?.rows?.find((r) => String(r.taskId) === String(task.id));
        if (row?.contract?.trim()) return row.contract.trim();
      }
    }
    return "—";
  })();

  const postCodeDisplay = (() => {
    const fromTask = task?.postCode?.trim();
    if (fromTask) return fromTask;
    const fromProperty = propertyQuery.data?.zipCode?.trim();
    if (fromProperty) return fromProperty;
    if (task && fromDaily) {
      const caches = queryClient.getQueriesData<ApiDailyProgramme>({ queryKey: dailyQueryKey });
      for (const [, programme] of caches) {
        const row = programme?.rows?.find((r) => String(r.taskId) === String(task.id));
        if (row?.postCode?.trim()) return row.postCode.trim();
      }
    }
    return "—";
  })();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
  });

  useEffect(() => {
    if (task) form.reset(taskToFormValues(task));
  }, [task, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toTaskPayload>) => tasksService.update(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Job updated");
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      if (fromDaily) {
        queryClient.invalidateQueries({ queryKey: ["daily-programme"] });
        navigate({ to: "/daily" });
        return;
      }
      if (fromCustomer && customerId) {
        navigate({ to: "/customers/$id", params: { id: customerId } });
        return;
      }
      if (fromSite && siteId) {
        navigate({ to: "/sites/$id", params: { id: siteId } });
        return;
      }
      if (fromProject && projectId) {
        navigate({ to: "/projects/$id", params: { id: projectId } });
        return;
      }
      if (fromProperty && propertyId) {
        navigate({ to: "/properties/$id", params: { id: propertyId } });
        return;
      }
      navigate({
        to: "/tasks/$id",
        params: { id },
        search: { mode: "view", ...contextSearch },
      });
    },
    onError: (err) => notifyApiError(err, "Failed to update job"),
  });

  async function submit(values: TaskFormValues) {
    await updateMutation.mutateAsync(toTaskPayload(values));
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading job…</div>;
  }

  if (isError || !task) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">Failed to load job.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
        {error ? <pre className="text-xs text-muted-foreground">{String(error)}</pre> : null}
      </div>
    );
  }

  return (
    <RequirePermission route={TASKS_ROUTE} action="read">
      <div className="min-w-0 w-full max-w-full">
        {!isEdit ? (
          <PageHeader
            title={task.taskNumber || task.propertyName}
            leading={
              <AppTooltip content={backLabel} asChild>
                <button
                  type="button"
                  onClick={goBack}
                  aria-label={backLabel}
                  className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </AppTooltip>
            }
            actions={
              <Can route={TASKS_ROUTE} action="modify">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: "/tasks/$id",
                      params: { id },
                      search: { mode: "edit", ...contextSearch },
                    })
                  }
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              </Can>
            }
          />
        ) : null}

        {isEdit ? (
          <Form form={form} onSubmit={submit} className="min-w-0 w-full max-w-full">
            <FormPageCard
              title={`Edit job ${task.taskNumber || ""}`.trim()}
              onBack={{ label: backLabel, onClick: goBack }}
              maxWidth="w-full max-w-4xl"
              footer={
                <div className="flex w-full flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (fromDaily || fromCustomer || fromProperty) {
                        goBack();
                        return;
                      }
                      navigate({
                        to: "/tasks/$id",
                        params: { id },
                        search: { mode: "view", ...contextSearch },
                      });
                    }}
                    disabled={updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <SubmitButton size="sm" loading={updateMutation.isPending}>
                    Save changes
                  </SubmitButton>
                </div>
              }
            >
              <TaskFormFields
                embedded
                disabled={updateMutation.isPending}
                itemsLocked={Boolean(task.isLocked)}
                selectedLabels={{
                  property: task.propertyName,
                  jobType: task.jobTypeName,
                  status: task.statusName,
                  siteManager: task.siteManagerName,
                }}
                itemSelectedLabels={Object.fromEntries(
                  (task.items ?? []).map((item) => [
                    String(item.id),
                    {
                      operative: item.operativeName,
                      tradeGroup: item.tradeGroupName,
                      product: item.productName,
                    },
                  ]),
                )}
              />
            </FormPageCard>
          </Form>
        ) : (
          <div className="min-w-0 w-full max-w-full space-y-4">
            <div className="card-elevated grid grid-cols-2 gap-x-4 gap-y-2 overflow-hidden px-4 py-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 [&>*]:min-w-0">
              <Detail label="Job number" value={<CodeBadge code={task.taskNumber} />} />
              <Detail label="Property" value={task.propertyName} />
              <Detail label="Property type" value={task.jobTypeName} />
              <Detail label="Client" value={<CodeWithLabel combined={customerDisplay} />} />
              <Detail label="Post Code" value={postCodeDisplay} />
              <Detail label="Start date" value={task.startDate?.slice(0, 10) || "—"} />
              <Detail label="HO" value={task.handOverDate?.slice(0, 10) || "—"} />
              <Detail label="Day" value={String(task.daysCount ?? 0)} />
              <Detail label="Price" value={formatPriceDisplay(task.budget)} />
              <Detail
                label="Status"
                value={
                  task.statusName ? <StatusBadge status={task.statusName} /> : "—"
                }
              />
              <Detail label="Site manager" value={task.siteManagerName || "—"} />
              <Detail label="Created" value={formatDateTime(task.createdDate)} />
              {task.description ? (
                <div className="min-w-0 col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-6">
                  <Detail label="Description" value={task.description} />
                </div>
              ) : null}
            </div>

            <JobWorkCalendar key={task.id} task={task} />
          </div>
        )}
      </div>
    </RequirePermission>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-sm font-medium leading-snug">{value}</div>
    </div>
  );
}
