import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Settings tab path — Roles is now a standalone Menu API route. */
export const Route = createFileRoute("/settings/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/roles" });
  },
});
