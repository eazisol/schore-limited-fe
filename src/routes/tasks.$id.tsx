import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calculator, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton } from "@/components/form";
import { Can, RequirePermission, usePermission } from "@/components/Permission";
import { tasksService } from "@/lib/api/services/tasks";
import { notifyApiError } from "@/lib/api/axios";
import { tasksQueryKey } from "./tasks.index";
import { TASKS_ROUTE } from "@/lib/tasks";
import {
  taskFormSchema,
  taskToFormValues,
  toTaskPayload,
  type TaskFormValues,
} from "@/lib/task-form";
import { TaskFormFields } from "@/components/tasks/TaskFormFields";
import { formatDateTime, truncateWithEllipsis } from "@/lib/module-ui";
import { fmtGBP } from "@/lib/data";
import { z } from "zod";

const searchSchema = z.object({
  mode: z.enum(["view", "edit"]).optional().default("view"),
  from: z.enum(["daily"]).optional(),
});

export const Route = createFileRoute("/tasks/$id")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Task | Schore" }] }),
  component: TaskDetail,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const { mode, from } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const isEdit = mode === "edit" && canModify;
  const fromDaily = from === "daily";
  const backTo = fromDaily ? "/daily" : "/tasks";
  const backLabel = fromDaily ? "Back to daily programme" : "Back to tasks";
  const dailySearch = fromDaily ? { from: "daily" as const } : undefined;

  const { data: task, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...tasksQueryKey, id],
    queryFn: async () => (await tasksService.get(id)).data,
  });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
  });

  useEffect(() => {
    if (task) form.reset(taskToFormValues(task));
  }, [task, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toTaskPayload>) => tasksService.update(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Task updated");
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      if (fromDaily) {
        queryClient.invalidateQueries({ queryKey: ["daily-programme"] });
        navigate({ to: "/daily" });
        return;
      }
      navigate({ to: "/tasks/$id", params: { id }, search: { mode: "view" } });
    },
    onError: (err) => notifyApiError(err, "Failed to update task"),
  });

  async function submit(values: TaskFormValues) {
    await updateMutation.mutateAsync(toTaskPayload(values));
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading task…</div>;
  }

  if (isError || !task) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">Failed to load task.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
        {error ? <pre className="text-xs text-muted-foreground">{String(error)}</pre> : null}
      </div>
    );
  }

  return (
    <RequirePermission route={TASKS_ROUTE} action="read">
      <div>
        <PageHeader
          title={isEdit ? `Edit task ${task.taskNumber || ""}`.trim() : task.taskNumber || task.propertyName}
          leading={
            <AppTooltip content={backLabel} asChild>
              <Link
                to={backTo}
                aria-label={backLabel}
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
          }
          actions={
            !isEdit ? (
              <Can route={TASKS_ROUTE} action="modify">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: "/tasks/$id",
                      params: { id },
                      search: { mode: "edit", ...dailySearch },
                    })
                  }
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              </Can>
            ) : null
          }
        />

        {isEdit ? (
          <Form form={form} onSubmit={submit} className="w-full space-y-6">
            <TaskFormFields
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
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (fromDaily) {
                    navigate({ to: "/daily" });
                    return;
                  }
                  navigate({ to: "/tasks/$id", params: { id }, search: { mode: "view" } });
                }}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <SubmitButton size="sm" loading={updateMutation.isPending}>
                Save changes
              </SubmitButton>
            </div>
          </Form>
        ) : (
          <div className="w-full space-y-6">
            <div className="card-elevated grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
              <Detail label="Task number" value={task.taskNumber || "—"} />
              <Detail label="Property" value={task.propertyName} />
              <Detail label="Job type" value={task.jobTypeName} />
              <Detail label="Start date" value={task.startDate?.slice(0, 10) || "—"} />
              <Detail label="Hand over" value={task.handOverDate?.slice(0, 10) || "—"} />
              <Detail
                label="Days"
                value={
                  task.heldDaysCount > 0
                    ? `${task.daysCount ?? 0} (−${task.heldDaysCount} held)`
                    : String(task.daysCount ?? 0)
                }
              />
              <Detail
                label="Budget"
                value={task.budget != null ? `£${Number(task.budget).toFixed(2)}` : "—"}
              />
              <Detail label="Status" value={task.statusName} />
              <Detail label="Site manager" value={task.siteManagerName || "—"} />
              <Detail label="Created" value={formatDateTime(task.createdDate)} />
              <div className="sm:col-span-2 lg:col-span-4">
                <Detail label="Description" value={task.description || "—"} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-display font-semibold">Items by operative</h3>
              {(task.itemsByOperative ?? []).length === 0 ? (
                <div className="card-elevated p-6 text-sm text-muted-foreground">No items.</div>
              ) : (
                task.itemsByOperative.map((group) => {
                  const groupTotal = group.items.reduce(
                    (sum, item) => sum + (Number(item.amount) || 0),
                    0,
                  );
                  return (
                  <div key={group.operativeId} className="card-elevated space-y-3 p-4 sm:p-6">
                    <h4 className="font-medium">{group.operativeName}</h4>
                    <div className="overflow-x-auto rounded-md border border-border/60">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/20 text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Package / Product</th>
                            <th className="px-3 py-2 font-medium">Qty</th>
                            <th className="px-3 py-2 font-medium">Rate</th>
                            <th className="px-3 py-2 font-medium">Amount</th>
                            <th className="px-3 py-2 font-medium">Ticked</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => {
                            const productLabel =
                              item.tradeGroupName || item.productName || "—";
                            const truncated = truncateWithEllipsis(productLabel, 28);
                            const needsTooltip = productLabel.length > 28;
                            return (
                            <tr key={item.id} className="border-b border-border/50">
                              <td className="px-3 py-2">{item.workDate?.slice(0, 10)}</td>
                              <td className="px-3 py-2">
                                {needsTooltip ? (
                                  <AppTooltip content={productLabel} asChild align="start">
                                    <span className="block max-w-[12rem] cursor-default truncate">
                                      {truncated}
                                    </span>
                                  </AppTooltip>
                                ) : (
                                  truncated
                                )}
                              </td>
                              <td className="px-3 py-2">{item.quantity}</td>
                              <td className="px-3 py-2">{fmtGBP(Number(item.rate))}</td>
                              <td className="px-3 py-2">
                                <AppTooltip content={fmtGBP(Number(item.amount))} asChild align="end">
                                  <span className="tabular-nums">{fmtGBP(Number(item.amount))}</span>
                                </AppTooltip>
                              </td>
                              <td className="px-3 py-2">{item.isTicked ? "Yes" : "No"}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {group.items.length > 0 ? (
                      <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/50 px-3 py-3 sm:px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                            <Calculator className="h-3.5 w-3.5" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">Total</div>
                            <div className="text-xs text-muted-foreground">
                              {group.items.length} item{group.items.length === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>
                        <AppTooltip content={fmtGBP(groupTotal)} asChild align="end">
                          <div className="shrink-0 font-display text-base font-semibold tabular-nums tracking-tight text-foreground sm:text-lg">
                            {fmtGBP(groupTotal)}
                          </div>
                        </AppTooltip>
                      </div>
                    ) : null}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
