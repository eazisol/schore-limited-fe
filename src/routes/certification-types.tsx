import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ManageFormsLayoutProvider } from "@/components/manage-forms/manage-forms-layout";
import { CertificationTypesColumn } from "@/components/certification-types/CertificationTypesColumn";

export const Route = createFileRoute("/certification-types")({
  head: () => ({ meta: [{ title: "Certificate | Schore" }] }),
  component: CertificationTypesPage,
});

function CertificationTypesPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Certificate" />
      <ManageFormsLayoutProvider layout="split">
        <CertificationTypesColumn />
      </ManageFormsLayoutProvider>
    </div>
  );
}
