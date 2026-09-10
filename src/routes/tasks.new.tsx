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
  from: z
    .enum(["daily", "customer", "property", "site", "project", "operative"])
    .optional(),
  customerId: z.string().optional(),
  propertyId: z.string().optional(),
  siteId: z.string().optional(),
  projectId: z.string().optional(),
  operativeId: z.string().optional(),
  returnTo: z.string().optional(),
});

export const Route = createFileRoute("/tasks/new")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Add Job | Schore" }] }),
  component: NewTask,
});

function NewTask() {
  const {
    from,
    propertyId,
    customerId,
    siteId,
    projectId,
    operativeId,
    returnTo,
  } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fromDaily = from === "daily";
  const fromCustomer = from === "customer" && Boolean(customerId);
  const fromProperty = from === "property" && Boolean(propertyId);
  const fromSite = from === "site" && Boolean(siteId);
  const fromProject = from === "project" && Boolean(projectId);
  const fromOperative = from === "operative" && Boolean(operativeId);
  const presetPropertyId = propertyId?.trim() || "";

  const goBack = () => {
    if (returnTo) {
      navigate({ to: returnTo as any });
      return;
    }
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
    if (fromOperative && operativeId) {
      navigate({ to: "/operatives/$id", params: { id: operativeId } });
      return;
    }
    navigate({ to: "/tasks" });
  };

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
            : fromOperative
              ? "Back to operative"
              : "Back to jobs";

  const backRoute = fromCustomer && customerId
    ? { to: "/customers/$id" as const, params: { id: String(customerId) } }
    : fromSite && siteId
      ? { to: "/sites/$id" as const, params: { id: String(siteId) } }
      : fromProject && projectId
        ? { to: "/projects/$id" as const, params: { id: String(projectId) } }
        : fromProperty && propertyId
          ? { to: "/properties/$id" as const, params: { id: String(propertyId) } }
          : fromOperative && operativeId
            ? { to: "/operatives/$id" as const, params: { id: String(operativeId) } }
            : fromDaily
              ? { to: "/daily" as const }
              : { to: "/tasks" as const };

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
      if (fromCustomer && customerId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", "customer-work", customerId] });
        queryClient.invalidateQueries({ queryKey: ["customers", customerId] });
        queryClient.invalidateQueries({ queryKey: ["users", customerId] });
      }
      if (fromSite && siteId) {
        queryClient.invalidateQueries({ queryKey: ["sites", siteId] });
      }
      if (fromProject && projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      }
      if (fromProperty && propertyId) {
        queryClient.invalidateQueries({ queryKey: ["properties", propertyId] });
      }
      if (fromOperative && operativeId) {
        queryClient.invalidateQueries({ queryKey: ["task-items", "operative", operativeId] });
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
            ...backRoute,
            label: backLabel,
          }}
          maxWidth="w-full max-w-4xl"
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
