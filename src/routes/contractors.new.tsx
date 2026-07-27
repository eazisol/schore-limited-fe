import { createFileRoute } from "@tanstack/react-router";
import { UserCreatePage } from "@/components/users/UserCreatePage";

export const Route = createFileRoute("/contractors/new")({
  head: () => ({ meta: [{ title: "Add Contractor | Schore" }] }),
  component: UserCreatePage,
});
