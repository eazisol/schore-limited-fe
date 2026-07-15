import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/system-config/user-types")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/user-types" });
  },
});
