import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ManageFormsLayoutProvider } from "@/components/manage-forms/manage-forms-layout";
import { CisColumn } from "@/components/cis/CisColumn";

export const Route = createFileRoute("/cis-management/")({
  head: () => ({ meta: [{ title: "CIS Management | Schore" }] }),
  component: CisManagementPage,
});

function CisManagementPage() {
  return (
    <div className="flex flex-col gap-3 xl:h-[calc(100svh-5.5rem)] xl:min-h-0 xl:overflow-hidden">
      <PageHeader title="CIS Management" />
      <ManageFormsLayoutProvider layout="split">
        <CisColumn />
      </ManageFormsLayoutProvider>
    </div>
  );
}
