import { createFileRoute } from "@tanstack/react-router";
import { UserCreatePage } from "@/components/users/UserCreatePage";

export const Route = createFileRoute("/users/new")({
  head: () => ({ meta: [{ title: "Add User | Schore" }] }),
  component: UserCreatePage,
});
