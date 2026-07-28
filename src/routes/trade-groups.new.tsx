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
import { tradeGroupsService } from "@/lib/api/services/trade-groups";
import { notifyApiError } from "@/lib/api/axios";
import { tradeGroupsQueryKey } from "./trade-groups.index";
import { TRADE_GROUPS_ROUTE } from "@/lib/trade-groups";
import {
  tradeGroupFormDefaults,
  tradeGroupFormSchema,
  toTradeGroupPayload,
  type TradeGroupFormValues,
} from "@/lib/trade-group-form";
import { TradeGroupFormFields } from "@/components/trade-groups/TradeGroupFormFields";

export const Route = createFileRoute("/trade-groups/new")({
  head: () => ({ meta: [{ title: "Add Trade Group | Schore" }] }),
  component: NewTradeGroup,
});

function NewTradeGroup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<TradeGroupFormValues>({
    resolver: zodResolver(tradeGroupFormSchema),
    defaultValues: tradeGroupFormDefaults,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toTradeGroupPayload>) =>
      tradeGroupsService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `${res.data?.name || "Trade group"} created`);
      queryClient.invalidateQueries({ queryKey: tradeGroupsQueryKey });
      navigate({ to: "/trade-groups" });
    },
    onError: (err) => notifyApiError(err, "Failed to create trade group"),
  });

  async function submit(values: TradeGroupFormValues) {
    await createMutation.mutateAsync(toTradeGroupPayload(values));
  }

  return (
    <RequirePermission route={TRADE_GROUPS_ROUTE} action="modify">
      <div>
        <PageHeader
          title="Add trade group"
          leading={
            <AppTooltip content="Back to trade groups" asChild>
              <Link
                to="/trade-groups"
                aria-label="Back to trade groups"
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
          }
        />

        <Form form={form} onSubmit={submit} className="max-w-5xl space-y-6">
          <TradeGroupFormFields disabled={createMutation.isPending} autoFocusName />

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/trade-groups" })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton loadingText="Saving…">Create trade group</SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
