import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ManageFormsLayoutProvider } from "@/components/manage-forms/manage-forms-layout";
import { TradesColumn } from "@/components/trades/TradesColumn";

export const Route = createFileRoute("/trade-builder/")({
  head: () => ({ meta: [{ title: "Trade Management | Schore" }] }),
  component: TradeManagementPage,
});

function TradeManagementPage() {
  return (
    <div className="flex flex-col xl:h-[calc(100svh-5.5rem)] xl:min-h-0 xl:overflow-hidden">
      <PageHeader title="Trade Management" />
      <ManageFormsLayoutProvider layout="split">
        <TradesColumn />
      </ManageFormsLayoutProvider>
    </div>
  );
}
