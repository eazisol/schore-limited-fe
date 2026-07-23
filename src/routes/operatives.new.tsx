import { createFileRoute } from "@tanstack/react-router";
import { UserCreatePage } from "@/components/users/UserCreatePage";

export const Route = createFileRoute("/operatives/new")({
  head: () => ({ meta: [{ title: "Add Operative | Schore" }] }),
  component: UserCreatePage,
});
