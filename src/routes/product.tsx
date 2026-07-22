import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Parent container for Product child menus (e.g. Items) from the Menu API. */
export const Route = createFileRoute("/product")({
  head: () => ({ meta: [{ title: "Product | Schore" }] }),
  component: () => <Outlet />,
});
