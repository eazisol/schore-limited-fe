import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Settings tab path — Permissions is now a standalone Menu API route. */
export const Route = createFileRoute("/settings/role-permissions")({
  beforeLoad: () => {
    throw redirect({ to: "/permissions" });
  },
});
