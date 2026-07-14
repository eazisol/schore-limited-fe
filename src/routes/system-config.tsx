import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/system-config")({
  head: () => ({ meta: [{ title: "System Configuration — Schore" }] }),
  component: SystemConfigLayout,
});

const TABS = [
  { to: "/system-config/roles", label: "Roles" },
  { to: "/system-config/user-types", label: "User Types" },
] as const;

function SystemConfigLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <div>
      <PageHeader
        title="System Configuration"
        subtitle="Manage roles and user types used across the platform."
      />
      <div className="border-b mb-6">
        <div className="flex gap-1">
          {TABS.map(t => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "px-4 h-10 inline-flex items-center text-sm font-medium border-b-2 -mb-px transition-colors",
                  active
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <Outlet />
    </div>
  );
}
