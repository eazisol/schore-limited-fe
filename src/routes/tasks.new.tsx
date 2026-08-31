import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { FormPageCard } from "@/components/FormPageCard";
import { Button } from "@/components/ui/button";
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
  const backLabel = fromDaily ? "Back to daily programmer" : "Back to tasks";

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
      <Form form={form} onSubmit={submit} className="min-w-0 w-full max-w-full">
        <FormPageCard
          title="Add task"
          back={{ to: backTo, label: backLabel }}
          maxWidth="w-full max-w-none"
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
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
          }
        >
          <TaskFormFields disabled={createMutation.isPending} embedded />
        </FormPageCard>
      </Form>
    </RequirePermission>
  );
}
