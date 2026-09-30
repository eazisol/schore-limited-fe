import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Parent container for Reports child menus (Job Report, Wages Report). */
export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports | Schore" }] }),
  component: () => <Outlet />,
});
