import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { RateApprovalsPanel } from "@/components/approvals/RateApprovalsPanel";
import { RepeatTaskApprovalsPanel } from "@/components/approvals/RepeatTaskApprovalsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/components/Permission";
import { RATE_APPROVALS_ROUTE } from "@/lib/api/services/rate-change-requests";
import { REPEAT_TASK_APPROVALS_ROUTE } from "@/lib/api/services/repeat-task-approvals";

const approvalsSearchSchema = z.object({
  tab: z.enum(["rates", "repeat"]).optional().catch("rates"),
  requestId: z.string().optional(),
});

export const Route = createFileRoute("/rate-approvals")({
  head: () => ({ meta: [{ title: "Approvals | Schore" }] }),
  validateSearch: approvalsSearchSchema,
  component: ApprovalsPage,
});

const TAB_TRIGGER_CLASS =
  "h-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 shadow-none data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:border-primary";

function ApprovalsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { tab, requestId } = Route.useSearch();
  const canRates = usePermission({ route: RATE_APPROVALS_ROUTE, action: "read" });
  const canRepeat = usePermission({ route: REPEAT_TASK_APPROVALS_ROUTE, action: "read" });

  const availableTabs = [
    ...(canRates ? (["rates"] as const) : []),
    ...(canRepeat ? (["repeat"] as const) : []),
  ];
  const activeTab =
    tab && availableTabs.includes(tab)
      ? tab
      : (availableTabs[0] ?? "rates");

  return (
    <div>
      <PageHeader title="Approvals" />

      <Tabs
        value={activeTab}
        onValueChange={(next) => {
          void navigate({
            search: (prev: { tab?: "rates" | "repeat"; requestId?: string }) => ({
              ...prev,
              tab: next === "repeat" ? "repeat" : "rates",
            }),
          });
        }}
        className="flex flex-col gap-3"
      >
        <TabsList className="inline-flex h-auto w-full shrink-0 flex-row items-start justify-start gap-4 rounded-none border-b border-border bg-transparent p-0 pb-0">
          {canRates ? (
            <TabsTrigger value="rates" className={TAB_TRIGGER_CLASS}>
              Rate Approvals
            </TabsTrigger>
          ) : null}
          {canRepeat ? (
            <TabsTrigger value="repeat" className={TAB_TRIGGER_CLASS}>
              Repeated Task
            </TabsTrigger>
          ) : null}
        </TabsList>

        {canRates ? (
          <TabsContent value="rates" className="mt-0 focus-visible:outline-none">
            <RateApprovalsPanel requestId={activeTab === "rates" ? requestId : undefined} />
          </TabsContent>
        ) : null}
        {canRepeat ? (
          <TabsContent value="repeat" className="mt-0 focus-visible:outline-none">
            <RepeatTaskApprovalsPanel requestId={activeTab === "repeat" ? requestId : undefined} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
