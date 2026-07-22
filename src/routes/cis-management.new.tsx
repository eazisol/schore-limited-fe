import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { cisService } from "@/lib/api/services/cis";
import { notifyApiError } from "@/lib/api/axios";
import { cisQueryKey } from "./cis-management.index";
import { CIS_ROUTE } from "@/lib/cis";
import { cisFormSchema, toCisPayload, type CisFormValues } from "@/lib/cis-form";
import { CisFormFields } from "@/components/cis/CisFormFields";

export const Route = createFileRoute("/cis-management/new")({
  head: () => ({ meta: [{ title: "Add CIS Status | Schore" }] }),
  component: NewCisStatus,
});

function NewCisStatus() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<CisFormValues>({
    resolver: zodResolver(cisFormSchema),
    defaultValues: {
      name: "",
      code: "",
      rate: 0,
      description: "",
      orderBy: 0,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toCisPayload>) => cisService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `${res.data?.name || "CIS status"} created`);
      queryClient.invalidateQueries({ queryKey: cisQueryKey });
      navigate({ to: "/cis-management" });
    },
    onError: (err) => notifyApiError(err, "Failed to create CIS status"),
  });

  async function submit(values: CisFormValues) {
    await createMutation.mutateAsync(toCisPayload(values));
  }

  return (
    <RequirePermission route={CIS_ROUTE} action="modify">
      <div>
        <PageHeader
          title="Add CIS Status"
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
        />

        <Form form={form} onSubmit={submit} className="max-w-3xl space-y-6">
          <div className="card-elevated space-y-4 p-6">
            <h3 className="font-display font-semibold">CIS details</h3>
            <CisFormFields disabled={createMutation.isPending} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/cis-management" })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton loadingText="Saving…">Create CIS status</SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
