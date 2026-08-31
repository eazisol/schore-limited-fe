import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormPageCard } from "@/components/FormPageCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton, SwitchField } from "@/components/form";
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
import { TradeGroupItemsEditor } from "@/components/trade-groups/TradeGroupItemsEditor";

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
      <Form form={form} onSubmit={submit} className="w-full">
        <FormPageCard
          title="Add trade group"
          back={{ to: "/trade-groups", label: "Back to trade groups" }}
          headerActions={<SwitchField<TradeGroupFormValues> name="isActive" label="Active" />}
          maxWidth="w-full max-w-none"
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/trade-groups" })}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <SubmitButton size="sm" loadingText="Saving…">
                Create trade group
              </SubmitButton>
            </div>
          }
        >
          <TradeGroupFormFields disabled={createMutation.isPending} embedded autoFocusName />
          <TradeGroupItemsEditor disabled={createMutation.isPending} embedded />
        </FormPageCard>
      </Form>
    </RequirePermission>
  );
}
