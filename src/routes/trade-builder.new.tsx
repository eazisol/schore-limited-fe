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
import { tradesService, type TradePayload } from "@/lib/api/services/trades";
import { notifyApiError } from "@/lib/api/axios";
import { tradesQueryKey } from "./trade-builder.index";

const TRADES_ROUTE = "/trade-builder";

export const Route = createFileRoute("/trade-builder/new")({
  head: () => ({ meta: [{ title: "Add Trade | Schore" }] }),
  component: NewTrade,
});

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Trade name is required")
    .max(100, "Trade name must be 100 characters or fewer"),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

function NewTrade() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", isActive: true },
  });

  const createMutation = useMutation({
    mutationFn: (payload: TradePayload) => tradesService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `${res.data?.name || "Trade"} created`);
      queryClient.invalidateQueries({ queryKey: tradesQueryKey });
      navigate({ to: "/trade-builder" });
    },
    onError: (err) => notifyApiError(err, "Failed to create trade"),
  });

  async function submit(values: Values) {
    await createMutation.mutateAsync({
      name: values.name.trim(),
      description: values.description.trim() || null,
      isActive: values.isActive,
    });
  }

  return (
    <RequirePermission route={TRADES_ROUTE} action="modify">
      <div>
        <PageHeader
          title="Add Trade"
          leading={
            <AppTooltip content="Back to trades" asChild>
              <Link
                to="/trade-builder"
                aria-label="Back to trades"
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
          }
        />

        <Form form={form} onSubmit={submit} className="max-w-3xl space-y-6">
          <div className="card-elevated space-y-4 p-6">
            <h3 className="font-display font-semibold">Trade details</h3>
            <TextField<Values> name="name" label="Trade name" required autoFocus maxLength={100} />
            <TextareaField<Values>
              name="description"
              label="Description"
              rows={3}
              maxLength={500}
            />
            <CheckboxField<Values>
              name="isActive"
              label="Active"
              description="Trade appears in operative and allocation dropdowns."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/trade-builder" })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton loadingText="Saving…">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create trade
            </SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
