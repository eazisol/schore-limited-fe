import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ManageFormsLayoutProvider } from "@/components/manage-forms/manage-forms-layout";
import { CategoriesColumn } from "@/components/categories/CategoriesColumn";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories | Schore" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  return (
    <div className="flex flex-col gap-3 xl:h-[calc(100svh-5.5rem)] xl:min-h-0 xl:overflow-hidden">
      <PageHeader title="Categories" />
      <ManageFormsLayoutProvider layout="split">
        <CategoriesColumn />
      </ManageFormsLayoutProvider>
    </div>
  );
}
