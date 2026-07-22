import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Product Management index — Menu API now uses `/product`. */
export const Route = createFileRoute("/product-management/")({
  beforeLoad: () => {
    throw redirect({ to: "/product" });
  },
});
