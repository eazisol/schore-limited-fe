import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cis-management/new")({
  beforeLoad: () => {
    throw redirect({ to: "/cis-management", replace: true });
  },
});
