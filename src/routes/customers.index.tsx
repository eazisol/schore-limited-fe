import { createFileRoute } from "@tanstack/react-router";
import { UsersListPage } from "@/components/users/UsersListPage";

export const Route = createFileRoute("/customers/")({
  head: () => ({ meta: [{ title: "Clients | Schore" }] }),
  component: UsersListPage,
});
