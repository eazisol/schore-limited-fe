import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Settings nested path — Email SMTP is now `/email-smtp`. */
export const Route = createFileRoute("/settings/email-smtp")({
  beforeLoad: () => {
    throw redirect({ to: "/email-smtp" });
  },
});
