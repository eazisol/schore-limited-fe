import { createFileRoute } from "@tanstack/react-router";
import { UserCreatePage } from "@/components/users/UserCreatePage";

export const Route = createFileRoute("/customers/new")({
  head: () => ({ meta: [{ title: "Add Client | Schore" }] }),
  component: UserCreatePage,
});
