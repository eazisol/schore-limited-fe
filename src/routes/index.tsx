import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard | Schore Limited" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center p-4">
      <div className="card-elevated w-full max-w-lg p-8 sm:p-10 text-center">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
          <Construction className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          This module hasn&apos;t been built yet. It&apos;ll be available in a later phase of the
          roadmap.
        </p>
      </div>
    </div>
  );
}
