import { createFileRoute, redirect } from "@tanstack/react-router";

/** Branding lives under Manage Forms (CEO tab). */
export const Route = createFileRoute("/branding")({
  beforeLoad: () => {
    throw redirect({ to: "/manage-forms", replace: true });
  },
});
