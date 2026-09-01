import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { FormPageCard } from "@/components/FormPageCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { tasksService } from "@/lib/api/services/tasks";
import { propertiesService } from "@/lib/api/services/properties";
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
  from: z.enum(["daily", "property"]).optional(),
  propertyId: z.string().optional(),
});

export const Route = createFileRoute("/tasks/new")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Add Job | Schore" }] }),
  component: NewTask,
});

function NewTask() {
  const { from, propertyId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fromDaily = from === "daily";
  const fromProperty = from === "property" && Boolean(propertyId);
  const presetPropertyId = propertyId?.trim() || "";

  const goBack = () => {
    if (fromDaily) {
      navigate({ to: "/daily" });
      return;
    }
    if (fromProperty && propertyId) {
      navigate({ to: "/properties/$id", params: { id: String(propertyId) } });
      return;
    }
    navigate({ to: "/tasks" });
  };

  const backLabel = fromDaily
    ? "Back to daily programmer"
    : fromProperty
      ? "Back to property"
      : "Back to jobs";

  const propertyQuery = useQuery({
    queryKey: ["properties", presetPropertyId],
    queryFn: async () => (await propertiesService.get(presetPropertyId)).data,
    enabled: Boolean(presetPropertyId),
    staleTime: 60_000,
  });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      ...taskFormDefaults,
      propertyId: presetPropertyId,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toTaskPayload>) => tasksService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `Job for ${res.data?.propertyName || "property"} created`);
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      if (fromDaily) {
        queryClient.invalidateQueries({ queryKey: ["daily-programme"] });
      }
      if (fromProperty && propertyId) {
        queryClient.invalidateQueries({ queryKey: ["properties", propertyId] });
      }
      goBack();
    },
    onError: (err) => notifyApiError(err, "Failed to create job"),
  });

  async function submit(values: TaskFormValues) {
    await createMutation.mutateAsync(toTaskPayload(values));
  }

  return (
    <RequirePermission route={TASKS_ROUTE} action="modify">
      <Form form={form} onSubmit={submit} className="min-w-0 w-full max-w-full">
        <FormPageCard
          title="Add job"
          back={{
            to: fromProperty && propertyId ? "/properties/$id" : fromDaily ? "/daily" : "/tasks",
            params: fromProperty && propertyId ? { id: String(propertyId) } : undefined,
            label: backLabel,
          }}
          maxWidth="w-full max-w-none"
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goBack}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <SubmitButton size="sm" loading={createMutation.isPending}>
                Create job
              </SubmitButton>
            </div>
          }
        >
          <TaskFormFields
            disabled={createMutation.isPending}
            embedded
            selectedLabels={{
              property: propertyQuery.data?.propertyName,
            }}
          />
        </FormPageCard>
      </Form>
    </RequirePermission>
  );
}
