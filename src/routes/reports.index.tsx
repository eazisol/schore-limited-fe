import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

/** Redirect /reports → first child (Job Report). */
export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "Reports | Schore" }] }),
  component: ReportsIndex,
});

function ReportsIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/reports/jobs", replace: true });
  }, [navigate]);

  return null;
}
