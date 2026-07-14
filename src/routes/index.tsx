import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Schore Limited" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of your workspace" />

      <div className="card-elevated p-12 grid place-items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent-foreground mb-4">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Coming Soon</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          The dashboard is being crafted. Check back shortly for a live view of your operations.
        </p>
      </div>
    </div>
  );
}
