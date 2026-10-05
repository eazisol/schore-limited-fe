import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UserDetailPage } from "@/components/users/UserDetailPage";
import { OPERATIVE_VIEW_TABS } from "@/lib/operative-view-tabs";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
  tab: z.string().optional(),
  viewTab: z.enum(OPERATIVE_VIEW_TABS).optional(),
});

export const Route = createFileRoute("/operatives/$id")({
  head: () => ({ meta: [{ title: "Operative | Schore" }] }),
  validateSearch: detailSearchSchema,
  component: UserDetailPage,
});
