import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard, Users, Building2, CalendarDays, Receipt,
  Tags, Briefcase, Activity, Settings, Search, Bell, HardHat, ChevronRight, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/daily", label: "Daily Programme", icon: CalendarDays },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/operatives", label: "Operatives", icon: Users },
  { to: "/wages", label: "Wage Sheets", icon: Receipt },
  { to: "/rates", label: "Rate Catalogue", icon: Tags },
  { to: "/contracts", label: "Contracts & Budgets", icon: Briefcase },
  { to: "/kpi", label: "KPI & Hold Board", icon: Activity },
  { to: "/users", label: "User Management", icon: ShieldCheck },
];

export function AppShell() {
  const pathname = useRouterState({ select: s => s.location.pathname });

  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-sm">SCHORE</div>
            <div className="text-[11px] text-sidebar-foreground/60 tracking-wide">Workforce & Payroll</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
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
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Link to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/60">
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <div className="mt-2 flex items-center gap-3 px-3 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/90 text-accent-foreground text-xs font-semibold">CC</div>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-medium truncate">Claudiu Ceausu</div>
              <div className="text-[11px] text-sidebar-foreground/60">Site Manager</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-background/80 backdrop-blur border-b border-border flex items-center gap-4 px-4 lg:px-8">
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
        <main className="flex-1 p-4 lg:p-8 min-w-0">
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
