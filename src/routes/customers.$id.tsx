import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UserDetailPage } from "@/components/users/UserDetailPage";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/customers/$id")({
  head: ({ params }) => ({ meta: [{ title: `Customer #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: UserDetailPage,
});
