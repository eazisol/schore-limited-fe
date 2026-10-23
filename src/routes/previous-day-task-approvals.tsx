import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — approvals live under /rate-approvals with tabs. */
export const Route = createFileRoute("/previous-day-task-approvals")({
  beforeLoad: () => {
    throw redirect({
      to: "/rate-approvals",
      search: { tab: "previous-day" },
    });
  },
});
