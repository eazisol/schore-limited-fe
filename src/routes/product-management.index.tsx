import { createFileRoute, Navigate } from "@tanstack/react-router";

/**
 * Product Management is a sidebar container. The catalogue lives under Items.
 */
export const Route = createFileRoute("/product-management/")({
  head: () => ({ meta: [{ title: "Product Management | Schore" }] }),
  component: () => <Navigate to="/items" replace />,
});
