import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/cis-management")({
  component: () => <Outlet />,
});
