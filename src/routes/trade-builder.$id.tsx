import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/trade-builder/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/trade-builder", replace: true });
  },
});
