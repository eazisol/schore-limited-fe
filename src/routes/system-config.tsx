import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Legacy path — children redirect to /settings/*. */
export const Route = createFileRoute("/system-config")({
  component: () => <Outlet />,
});
