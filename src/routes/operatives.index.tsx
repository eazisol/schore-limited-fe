import { createFileRoute } from "@tanstack/react-router";
import { UsersListPage } from "@/components/users/UsersListPage";

export const Route = createFileRoute("/operatives/")({
  head: () => ({ meta: [{ title: "Operatives | Schore" }] }),
  component: UsersListPage,
});

export const operativesQueryKey = ["users", "operatives"] as const;
