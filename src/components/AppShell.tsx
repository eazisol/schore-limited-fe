import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard, Users, Building2, CalendarDays, Receipt,
  Tags, Briefcase, Activity, Settings, Search, Bell, HardHat, ChevronRight, ShieldCheck,
  Hammer, Layers, ClipboardCheck, OctagonPause, Banknote, FileCheck2, PoundSterling,
  UserCog, FileBarChart2, BookMarked, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sessionStore, useSession } from "@/lib/session-store";
import { ROLES, ROLE_BADGE, type UserRole } from "@/lib/users-store";

type NavItem = { to: string; label: string; icon: any; exact?: boolean; adminOnly?: boolean };
type NavSection = { label: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/daily", label: "Daily Programme", icon: CalendarDays },
      { to: "/allocation", label: "Daily Allocation", icon: ListChecks },
      { to: "/confirmation", label: "Work Confirmation", icon: ClipboardCheck },
      { to: "/hold", label: "Hold Management", icon: OctagonPause },
      { to: "/kpi", label: "KPI Board", icon: Activity },
    ],
  },
  {
    label: "Workforce",
    items: [
      { to: "/operatives", label: "Operatives", icon: Users },
      { to: "/trade-builder", label: "Trade Builder", icon: Hammer },
      { to: "/prelims", label: "Prelims", icon: UserCog },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/payroll", label: "Payroll Engine", icon: Banknote },
      { to: "/wages", label: "Wage Sheets", icon: Receipt },
      { to: "/statements", label: "Statement Approval", icon: FileCheck2 },
      { to: "/cost-budget", label: "Cost & Budget", icon: PoundSterling },
      { to: "/rates", label: "Rate Catalogue", icon: Tags },
      { to: "/legend-codes", label: "Legend Codes", icon: BookMarked },
    ],
  },
  {
    label: "Records",
    items: [
      { to: "/properties", label: "Properties", icon: Building2 },
      { to: "/contracts", label: "Contracts", icon: Briefcase },
      { to: "/reports", label: "Reports & Exports", icon: FileBarChart2 },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/users", label: "User Management", icon: ShieldCheck, adminOnly: true },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppShell() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const session = useSession();
  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border shrink-0">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-sm">SCHORE</div>
            <div className="text-[11px] text-sidebar-foreground/60 tracking-wide">Workforce & Payroll</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto scrollbar-sidebar">
          {sections.map(section => {
            const items = section.items.filter(i => !i.adminOnly || session.role === "Admin");
            if (items.length === 0) return null;
            return (
              <div key={section.label}>
                <div className="px-3 mb-1 text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/40">{section.label}</div>
                <div className="space-y-0.5">
                  {items.map(({ to, label, icon: Icon, exact }) => {
                    const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={cn(
                          "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 shrink-0">

          <div className="px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/90 text-accent-foreground text-xs font-semibold">{session.initials}</div>
              <div className="min-w-0 leading-tight flex-1">
                <div className="text-sm font-medium truncate">{session.name}</div>
                <div className="text-[11px] text-sidebar-foreground/60 truncate">{session.jobTitle}</div>
              </div>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", ROLE_BADGE[session.role])}>
                {session.role}
              </span>
            </div>
            <label className="mt-3 block">
              <span className="text-[10px] uppercase tracking-wide text-sidebar-foreground/50">Switch role (demo)</span>
              <select
                value={session.role}
                onChange={e => {
                  const r = e.target.value as UserRole;
                  sessionStore.setRole(r);
                  toast.success(`Signed in as ${r}`);
                }}
                className="mt-1 w-full h-8 rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground text-xs px-2"
                aria-label="Switch role"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <Link
              to="/signin"
              className="mt-3 flex items-center justify-center h-8 rounded-md border border-sidebar-border text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              Sign out
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="shrink-0 h-16 bg-background/80 backdrop-blur border-b border-border flex items-center gap-4 px-4 lg:px-8">

          <div className="flex items-center text-xs text-muted-foreground gap-1.5 min-w-0">
            <Link to="/" className="hover:text-foreground">Home</Link>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 truncate">
                <ChevronRight className="h-3 w-3" />
                <span className="capitalize truncate">{c.replace(/-/g, " ")}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-card w-72">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search properties, operatives…"
                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
              />
              <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">⌘K</kbd>
            </div>
            <button
              type="button"
              onClick={() => toast("No new notifications", { description: "You're all caught up." })}
              className="relative h-9 w-9 grid place-items-center rounded-md border border-input bg-card hover:bg-accent/10"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-elegant p-4 lg:p-8 min-w-0">
          <Outlet />
        </main>

      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-display font-semibold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
