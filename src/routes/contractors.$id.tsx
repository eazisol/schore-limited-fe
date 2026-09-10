import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UserDetailPage } from "@/components/users/UserDetailPage";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
  tab: z.string().optional(),
});

export const Route = createFileRoute("/contractors/$id")({
  head: () => ({ meta: [{ title: "Contractor | Schore" }] }),
  validateSearch: detailSearchSchema,
  component: UserDetailPage,
});
