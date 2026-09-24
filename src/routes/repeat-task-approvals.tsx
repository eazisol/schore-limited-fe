import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — approvals live under /rate-approvals with tabs. */
export const Route = createFileRoute("/repeat-task-approvals")({
  beforeLoad: () => {
    throw redirect({
      to: "/rate-approvals",
      search: { tab: "repeat" },
    });
  },
});
