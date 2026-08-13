import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { DaySuggestionsColumn } from "@/components/manage-forms/DaySuggestionsColumn";
import { HoldReasonsColumn } from "@/components/manage-forms/HoldReasonsColumn";
import { JobTypesColumn } from "@/components/manage-forms/JobTypesColumn";
import { StatusesColumn } from "@/components/manage-forms/StatusesColumn";

export const Route = createFileRoute("/manage-forms")({
  head: () => ({ meta: [{ title: "Manage Forms | Schore" }] }),
  component: ManageFormsPage,
});

function ManageFormsPage() {
  return (
    <div className="flex flex-col gap-3 xl:h-[calc(100svh-5.5rem)] xl:min-h-0 xl:overflow-hidden">
      <PageHeader
        title="Manage Forms"
        subtitle="Statuses, job types, day suggestions, and hold reasons."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-4 xl:overflow-hidden">
        <StatusesColumn />
        <JobTypesColumn />
        <DaySuggestionsColumn />
        <HoldReasonsColumn />
      </div>
    </div>
  );
}
