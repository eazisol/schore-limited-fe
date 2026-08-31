import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cis-management/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/cis-management", replace: true });
  },
});
