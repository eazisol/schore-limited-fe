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
import { tradesService } from "@/lib/api/services/trades";
import { notifyApiError } from "@/lib/api/axios";
import { tradesQueryKey } from "./trade-builder.index";
import { TRADES_ROUTE } from "@/lib/trades";
import { tradeFormSchema, toTradePayload, type TradeFormValues } from "@/lib/trade-form";
import { TradeFormFields } from "@/components/trades/TradeFormFields";

export const Route = createFileRoute("/trade-builder/new")({
  head: () => ({ meta: [{ title: "Add Trade | Schore" }] }),
  component: NewTrade,
});

function NewTrade() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toTradePayload>) => tradesService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `${res.data?.name || "Trade"} created`);
      queryClient.invalidateQueries({ queryKey: tradesQueryKey });
      navigate({ to: "/trade-builder" });
    },
    onError: (err) => notifyApiError(err, "Failed to create trade"),
  });

  async function submit(values: TradeFormValues) {
    await createMutation.mutateAsync(toTradePayload(values, 0));
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
          <div className="card-elevated space-y-4 p-4 sm:p-6">
            <TradeFormFields disabled={createMutation.isPending} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/trade-builder" })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton size="sm" loadingText="Saving…">Create trade</SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
