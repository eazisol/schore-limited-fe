import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/trade-builder")({
  component: () => <Outlet />,
});
