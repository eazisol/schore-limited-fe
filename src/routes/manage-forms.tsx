import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { DaySuggestionsColumn } from "@/components/manage-forms/DaySuggestionsColumn";
import { HoldReasonsColumn } from "@/components/manage-forms/HoldReasonsColumn";
import { JobTypesColumn } from "@/components/manage-forms/JobTypesColumn";
import { ManageFormsLayoutProvider } from "@/components/manage-forms/manage-forms-layout";
import { StatusesColumn } from "@/components/manage-forms/StatusesColumn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/manage-forms")({
  head: () => ({ meta: [{ title: "Manage Forms | Schore" }] }),
  component: ManageFormsPage,
});

const TAB_TRIGGER_CLASS =
  "h-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 shadow-none data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:border-primary";

const TAB_PANEL_CLASS =
  "mt-0 flex min-h-[28rem] min-w-0 flex-1 flex-col focus-visible:outline-none xl:min-h-0";

function ManageFormsPage() {
  return (
    <div className="flex flex-col gap-3 xl:h-[calc(100svh-5.5rem)] xl:min-h-0 xl:overflow-hidden">
      <PageHeader
        title="Manage Forms"
        subtitle="Statuses, job types, day suggestions, and hold reasons."
      />

      <ManageFormsLayoutProvider layout="split">
        <Tabs defaultValue="statuses" className="flex min-h-0 flex-1 flex-col gap-4">
          <TabsList className="inline-flex h-auto w-full shrink-0 flex-row items-start justify-start gap-4 rounded-none border-b border-border bg-transparent p-0 pb-0">
            <TabsTrigger value="statuses" className={TAB_TRIGGER_CLASS}>
              Statuses
            </TabsTrigger>
            <TabsTrigger value="job-types" className={TAB_TRIGGER_CLASS}>
              Job Types
            </TabsTrigger>
            <TabsTrigger value="day-suggestions" className={TAB_TRIGGER_CLASS}>
              Day Suggestions
            </TabsTrigger>
            <TabsTrigger value="hold-reasons" className={TAB_TRIGGER_CLASS}>
              Hold Reasons
            </TabsTrigger>
          </TabsList>

          <TabsContent value="statuses" className={TAB_PANEL_CLASS}>
            <StatusesColumn />
          </TabsContent>
          <TabsContent value="job-types" className={TAB_PANEL_CLASS}>
            <JobTypesColumn />
          </TabsContent>
          <TabsContent value="day-suggestions" className={TAB_PANEL_CLASS}>
            <DaySuggestionsColumn />
          </TabsContent>
          <TabsContent value="hold-reasons" className={TAB_PANEL_CLASS}>
            <HoldReasonsColumn />
          </TabsContent>
        </Tabs>
      </ManageFormsLayoutProvider>
    </div>
  );
}
