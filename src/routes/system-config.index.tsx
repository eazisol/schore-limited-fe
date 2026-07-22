import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/system-config/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings" });
  },
});
