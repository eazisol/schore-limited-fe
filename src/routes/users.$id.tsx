import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UserDetailPage } from "@/components/users/UserDetailPage";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/users/$id")({
  head: () => ({ meta: [{ title: "User | Schore" }] }),
  validateSearch: detailSearchSchema,
  component: UserDetailPage,
});
