import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ManageFormsLayoutProvider } from "@/components/manage-forms/manage-forms-layout";
import { RolesColumn } from "@/components/roles/RolesColumn";

export const Route = createFileRoute("/roles")({
  head: () => ({ meta: [{ title: "Roles | Schore" }] }),
  component: RolesPage,
});

function RolesPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Roles" />
      <ManageFormsLayoutProvider layout="split">
        <RolesColumn />
      </ManageFormsLayoutProvider>
    </div>
  );
}
