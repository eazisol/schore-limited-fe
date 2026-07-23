import { createFileRoute } from "@tanstack/react-router";
import { UsersListPage } from "@/components/users/UsersListPage";

export const Route = createFileRoute("/users/")({
  head: () => ({ meta: [{ title: "User Management | Schore" }] }),
  component: UsersListPage,
});

/** @deprecated Prefer userModuleConfig(mode).queryKey */
export const usersQueryKey = ["users"] as const;
