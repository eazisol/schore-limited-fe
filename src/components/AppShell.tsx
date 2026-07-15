import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard,
  Settings,
  Bell,
  HardHat,
  ChevronRight,
  ShieldCheck,
  LogOut,
  UserCircle,
  PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_BADGE, type UserRole } from "@/lib/users-store";
import { permissionsForRole } from "@/lib/roles-store";
import type { PermissionKey } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  permission?: PermissionKey;
  anyOf?: PermissionKey[];
};
type NavSection = { label: string; items: NavItem[] };

// NOTE (Phase 1): Only Authentication, User Management and Settings are active.
// Other modules are hidden from the sidebar for now; their routes and code are
// preserved and will be re-enabled section by section in later phases.
const sections: NavSection[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  // { label: "Operations", items: [
  //   { to: "/daily",         label: "Daily Programme",   icon: CalendarDays,    permission: "daily.view" },
  //   { to: "/allocation",    label: "Daily Allocation",  icon: ListChecks,      permission: "daily.allocate" },
  //   { to: "/confirmation",  label: "Work Confirmation", icon: ClipboardCheck,  permission: "daily.confirm" },
  //   { to: "/hold",          label: "Hold Management",   icon: OctagonPause,    permission: "hold.view" },
  //   { to: "/kpi",           label: "KPI Board",         icon: Activity,        permission: "kpi.view" },
  // ]},
  // { label: "Workforce", items: [
  //   { to: "/operatives",    label: "Operatives",        icon: Users,           permission: "operatives.view" },
  //   { to: "/trade-builder", label: "Trade Builder",     icon: Hammer,          permission: "trades.view" },
  //   { to: "/prelims",       label: "Prelims",           icon: UserCog,         permission: "prelims.view" },
  // ]},
  // { label: "Finance", items: [
  //   { to: "/payroll",       label: "Payroll Engine",    icon: Banknote,        permission: "payroll.view" },
  //   { to: "/wages",         label: "Wage Sheets",       icon: Receipt,         permission: "wages.view" },
  //   { to: "/statements",    label: "Statement Approval",icon: FileCheck2,      permission: "statements.view" },
  //   { to: "/cost-budget",   label: "Cost & Budget",     icon: PoundSterling,   permission: "costs.view" },
  //   { to: "/rates",         label: "Rate Catalogue",    icon: Tags,            permission: "rates.view" },
  //   { to: "/legend-codes",  label: "Legend Codes",      icon: BookMarked,      permission: "legend.view" },
  // ]},
  // { label: "Records", items: [
  //   { to: "/properties",    label: "Properties",        icon: Building2,       permission: "properties.view" },
  //   { to: "/contracts",     label: "Contracts",         icon: Briefcase,       permission: "contracts.view" },
  //   { to: "/reports",       label: "Reports & Exports", icon: FileBarChart2,   permission: "reports.view" },
  // ]},
  {
    label: "Admin",
    items: [
      { to: "/users", label: "User Management", icon: ShieldCheck, permission: "users.view" },
      { to: "/settings", label: "Settings", icon: Settings, permission: "settings.view" },
    ],
  },
];

const PUBLIC_PATHS = ["/signin", "/forgot-password", "/reset-password"];

export function AppShell() {
  const { user: authUser, isHydrated, isAuthenticated, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  if (isHydrated && !isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
    navigate({ to: "/signin", search: { redirect: pathname } as any });
  }

  if (!isHydrated || !authUser) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const user = {
    name: authUser.fullName,
    role: authUser.role as UserRole,
    jobTitle: authUser.roles.join(", "),
    avatar: undefined as string | undefined,
  };

  // Role & permission gating is intentionally disabled for now.
  void permissionsForRole;
  const can = (_p?: PermissionKey, _anyOf?: PermissionKey[]) => true;

  return (
    <SidebarProvider className="h-svh overflow-hidden !min-h-0">
      <AppShellChrome
        user={user}
        email={authUser.email}
        can={can}
        onSignOut={() => {
          signOut();
          toast.success("Signed out");
          navigate({ to: "/signin" });
        }}
      />
    </SidebarProvider>
  );
}

function AppShellChrome({
  user,
  email,
  can,
  onSignOut,
}: {
  user: { name: string; role: UserRole; avatar?: string };
  email: string;
  can: (p?: PermissionKey, anyOf?: PermissionKey[]) => boolean;
  onSignOut: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile, state, isMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  const crumbs = pathname.split("/").filter(Boolean);
  const initials = user.name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const roleBadgeClass = ROLE_BADGE[user.role] ?? "bg-muted text-foreground/70 border-border";

  function closeMobileNav() {
    setOpenMobile(false);
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border h-16 justify-center">
          <div className={cn("flex items-center gap-2.5 px-2", collapsed && "justify-center px-0")}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
              <HardHat className="h-5 w-5" />
            </div>
            <div
              className={cn(
                "leading-tight min-w-0 transition-opacity duration-200",
                collapsed && "sr-only",
              )}
            >
              <div className="font-display font-semibold text-sm truncate">SCHORE</div>
              <div className="text-[11px] text-sidebar-foreground/60 tracking-wide truncate">
                Workforce & Payroll
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="scrollbar-sidebar">
          {sections.map((section) => {
            const items = section.items.filter((i) => can(i.permission, i.anyOf));
            if (items.length === 0) return null;
            return (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel className="uppercase tracking-wider text-[10px] font-semibold text-sidebar-foreground/40">
                  {section.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map(({ to, label, icon: Icon, exact }) => {
                      const active = exact
                        ? pathname === to
                        : pathname === to || pathname.startsWith(to + "/");
                      return (
                        <SidebarMenuItem key={to}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={label}
                            className={cn(
                              "text-sidebar-foreground/75 hover:text-sidebar-foreground",
                              active && "font-medium",
                            )}
                          >
                            <Link to={to} onClick={closeMobileNav}>
                              <Icon />
                              <span>{label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <div className={cn("px-1 py-1", collapsed && "flex flex-col items-center gap-1")}>
            <div
              className={cn(
                "flex items-center gap-3 px-2 py-1.5",
                collapsed && "justify-center px-0",
              )}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/90 text-accent-foreground text-xs font-semibold shrink-0">
                  {initials}
                </div>
              )}
              <div className={cn("min-w-0 leading-tight flex-1", collapsed && "sr-only")}>
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-[11px] text-sidebar-foreground/60 truncate">{email}</div>
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0",
                  roleBadgeClass,
                  collapsed && "sr-only",
                )}
              >
                {user.role}
              </span>
            </div>

            <div
              className={cn(
                "mt-2",
                collapsed ? "flex flex-col items-center gap-1.5" : "grid grid-cols-2 gap-1.5 px-2",
              )}
            >
              <Link
                to="/profile"
                onClick={closeMobileNav}
                title="Profile"
                className={cn(
                  "flex items-center justify-center gap-1.5 h-8 rounded-md border border-sidebar-border text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  collapsed && "size-8 p-0",
                )}
              >
                <UserCircle className="h-3.5 w-3.5" />
                <span className={cn(collapsed && "sr-only")}>Profile</span>
              </Link>
              <button
                type="button"
                title="Sign out"
                onClick={() => {
                  closeMobileNav();
                  onSignOut();
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 h-8 rounded-md border border-sidebar-border text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  collapsed && "size-8 p-0",
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className={cn(collapsed && "sr-only")}>Sign out</span>
              </button>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh max-h-svh overflow-hidden">
        <header className="shrink-0 h-16 bg-background/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 lg:px-8">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 md:hidden"
            onClick={toggleSidebar}
            aria-label="Open menu"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <SidebarTrigger
            className="hidden md:inline-flex h-9 w-9 border border-input bg-card hover:bg-accent/10"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          />

          <div className="flex items-center text-xs text-muted-foreground gap-1.5 min-w-0">
            <Link to="/" className="hover:text-foreground shrink-0">
              Home
            </Link>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 truncate">
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="capitalize truncate">{c.replace(/-/g, " ")}</span>
              </span>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                toast("No new notifications", { description: "You're all caught up." })
              }
              className="relative h-9 w-9 grid place-items-center rounded-md border border-input bg-card hover:bg-accent/10"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-elegant p-4 lg:p-8 min-w-0">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
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
