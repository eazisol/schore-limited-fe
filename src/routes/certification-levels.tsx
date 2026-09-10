import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ManageFormsLayoutProvider } from "@/components/manage-forms/manage-forms-layout";
import { CertificationLevelsColumn } from "@/components/certification-levels/CertificationLevelsColumn";

export const Route = createFileRoute("/certification-levels")({
  head: () => ({ meta: [{ title: "Certification Levels | Schore" }] }),
  component: CertificationLevelsPage,
});

function CertificationLevelsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Certification levels" />
      <ManageFormsLayoutProvider layout="split">
        <CertificationLevelsColumn />
      </ManageFormsLayoutProvider>
    </div>
  );
}
