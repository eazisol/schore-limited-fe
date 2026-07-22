import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Parent container for Settings child menus (e.g. Email SMTP) from the Menu API. */
export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings | Schore" }] }),
  component: () => <Outlet />,
});
