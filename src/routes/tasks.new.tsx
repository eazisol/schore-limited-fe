import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { tasksService } from "@/lib/api/services/tasks";
import { notifyApiError } from "@/lib/api/axios";
import { tasksQueryKey } from "./tasks.index";
import { TASKS_ROUTE } from "@/lib/tasks";
import {
  taskFormDefaults,
  taskFormSchema,
  toTaskPayload,
  type TaskFormValues,
} from "@/lib/task-form";
import { TaskFormFields } from "@/components/tasks/TaskFormFields";

const searchSchema = z.object({
  from: z.enum(["daily"]).optional(),
});

export const Route = createFileRoute("/tasks/new")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Add Task | Schore" }] }),
  component: NewTask,
});

function NewTask() {
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fromDaily = from === "daily";
  const backTo = fromDaily ? "/daily" : "/tasks";
  const backLabel = fromDaily ? "Back to daily programme" : "Back to tasks";

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: taskFormDefaults,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toTaskPayload>) => tasksService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `Task for ${res.data?.propertyName || "property"} created`);
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      if (fromDaily) {
        queryClient.invalidateQueries({ queryKey: ["daily-programme"] });
      }
      navigate({ to: backTo });
    },
    onError: (err) => notifyApiError(err, "Failed to create task"),
  });

  async function submit(values: TaskFormValues) {
    await createMutation.mutateAsync(toTaskPayload(values));
  }

  return (
    <RequirePermission route={TASKS_ROUTE} action="modify">
      <div>
        <PageHeader
          title="Add task"
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
        />

        <Form form={form} onSubmit={submit} className="max-w-5xl space-y-6">
          <TaskFormFields disabled={createMutation.isPending} />

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: backTo })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton size="sm" loading={createMutation.isPending}>
              Create task
            </SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
