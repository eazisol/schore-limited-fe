import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UserDetailPage } from "@/components/users/UserDetailPage";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/operatives/$id")({
  head: ({ params }) => ({ meta: [{ title: `Operative #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: UserDetailPage,
});
