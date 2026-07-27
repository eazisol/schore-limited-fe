import { createFileRoute } from "@tanstack/react-router";
import { UsersListPage } from "@/components/users/UsersListPage";

export const Route = createFileRoute("/contractors/")({
  head: () => ({ meta: [{ title: "Contractors | Schore" }] }),
  component: UsersListPage,
});
