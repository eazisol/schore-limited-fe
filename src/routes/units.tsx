import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ManageFormsLayoutProvider } from "@/components/manage-forms/manage-forms-layout";
import { UnitsColumn } from "@/components/units/UnitsColumn";

export const Route = createFileRoute("/units")({
  head: () => ({ meta: [{ title: "Units | Schore" }] }),
  component: UnitsPage,
});

function UnitsPage() {
  return (
    <div className="flex flex-col gap-3 xl:h-[calc(100svh-5.5rem)] xl:min-h-0 xl:overflow-hidden">
      <PageHeader title="Units" />
      <ManageFormsLayoutProvider layout="split">
        <UnitsColumn />
      </ManageFormsLayoutProvider>
    </div>
  );
}
