import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Parent container for Product Management child menus (e.g. Items). */
export const Route = createFileRoute("/product-management")({
  component: () => <Outlet />,
});
