import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trade-builder")({
  head: () => ({ meta: [{ title: "Trade Builder — Schore" }] }),
  component: TradeBuilderLayout,
});

const tabs = [
  { to: "/trade-builder", label: "Trades", exact: true },
  { to: "/trade-builder/groups", label: "Groups" },
  { to: "/trade-builder/tasks", label: "Tasks" },
];

function TradeBuilderLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <div>
      <PageHeader title="Trade Builder" subtitle="Manage trades, their groups (KF / C1 / Day Work…) and the task catalogue." />
      <div className="border-b border-border mb-6 flex gap-1">
        {tabs.map(t => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to} className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{t.label}</Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
