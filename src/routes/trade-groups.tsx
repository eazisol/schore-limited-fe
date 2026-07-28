import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/trade-groups")({
  component: () => <Outlet />,
});
