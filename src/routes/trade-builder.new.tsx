import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/trade-builder/new")({
  beforeLoad: () => {
    throw redirect({ to: "/trade-builder", replace: true });
  },
});
