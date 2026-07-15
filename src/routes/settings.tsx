import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Schore" }] }),
  component: SettingsLayout,
});

const TABS = [
  { to: "/settings/user-types", label: "User Types" },
  { to: "/settings/roles", label: "Roles" },
  { to: "/settings/role-permissions", label: "Role Permissions" },
  { to: "/settings/email-smtp", label: "Email SMTP" },
] as const;

function SettingsLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage user types, roles, permissions and email configuration."
      />
      <div className="border-b mb-6">
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden">
          {TABS.map(t => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "px-4 h-10 inline-flex items-center text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
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
