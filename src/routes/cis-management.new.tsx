import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  TextField,
  TextareaField,
  CheckboxField,
  SubmitButton,
} from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { cisService, type CisStatusPayload } from "@/lib/api/services/cis";
import { notifyApiError } from "@/lib/api/axios";
import { cisQueryKey } from "./cis-management.index";

const CIS_ROUTE = "/cis-management";

export const Route = createFileRoute("/cis-management/new")({
  head: () => ({ meta: [{ title: "Add CIS Status | Schore" }] }),
  component: NewCisStatus,
});

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or fewer"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  rate: z.coerce
    .number()
    .min(0, "Rate must be 0 or greater")
    .max(100, "Rate must be 100 or less"),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer"),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

function NewCisStatus() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      rate: 20,
      description: "",
      isDefault: false,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CisStatusPayload) => cisService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `${res.data?.name || "CIS status"} created`);
      queryClient.invalidateQueries({ queryKey: cisQueryKey });
      navigate({ to: "/cis-management" });
    },
    onError: (err) => notifyApiError(err, "Failed to create CIS status"),
  });

  async function submit(values: Values) {
    await createMutation.mutateAsync({
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      rate: values.rate,
      description: values.description.trim() || null,
      isDefault: values.isDefault,
      isActive: values.isActive,
    });
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField<Values> name="code" label="Code" required autoFocus maxLength={20} />
              <TextField<Values> name="name" label="Name" required maxLength={100} />
            </div>
            <TextField<Values>
              name="rate"
              label="Deduction rate (%)"
              required
              type="number"
              min={0}
              max={100}
              step="1"
            />
            <TextareaField<Values>
              name="description"
              label="Description"
              rows={3}
              maxLength={500}
            />
            <CheckboxField<Values>
              name="isDefault"
              label="Default status"
              description="New operatives will use this CIS rate when no other is selected."
            />
            <CheckboxField<Values>
              name="isActive"
              label="Active"
              description="Status can be selected on operative records."
            />
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
            <SubmitButton loadingText="Saving…">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create CIS status
            </SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
