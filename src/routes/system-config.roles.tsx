import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/system-config/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/roles" });
  },
});
