import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  HardHat,
  ChevronRight,
  LogOut,
  UserCircle,
  PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_BADGE, type UserRole } from "@/lib/users-store";
import { buildNavMenus, isPublicPath, toAppPath } from "@/lib/authorization";
import { resolveMenuIcon } from "@/lib/menu-icons";
import type { ApiMenu } from "@/lib/api/services/auth";
import { RoutePermissionGuard } from "@/components/Permission";
import { resolveProfileImageUrl, usersService } from "@/lib/api/services/users";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppShell() {
  const { user: authUser, isHydrated, isAuthenticated, signOut, menus } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  if (isHydrated && !isAuthenticated && !isPublicPath(pathname)) {
    navigate({ to: "/signin", search: { redirect: pathname } as never });
  }

  if (!isHydrated || !authUser) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden !min-h-0">
      <AppShellChrome
        userId={authUser.id}
        userName={authUser.fullName}
        userRole={authUser.role as UserRole}
        email={authUser.email}
        menus={menus}
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
  userId,
  userName,
  userRole,
  email,
  menus,
  onSignOut,
}: {
  userId: number;
  userName: string;
  userRole: UserRole;
  email: string;
  menus: ApiMenu[];
  onSignOut: () => void;
}) {
  const profileQuery = useQuery({
    queryKey: ["users", userId],
    queryFn: async () => (await usersService.get(userId)).data,
    staleTime: 60_000,
  });

  const user = {
    name: userName,
    role: userRole,
    avatar: resolveProfileImageUrl(profileQuery.data?.profileImagePath) || undefined,
  };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile, state, isMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const navMenus = buildNavMenus(menus);

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
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase tracking-wider text-[10px] font-semibold text-sidebar-foreground/40">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navMenus.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-sidebar-foreground/50">No menus assigned</li>
                ) : (
                  navMenus.map((menu) => (
                    <NavMenuItem
                      key={menu.id}
                      menu={menu}
                      pathname={pathname}
                      onNavigate={closeMobileNav}
                    />
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
          <RoutePermissionGuard pathname={pathname}>
            <Outlet />
          </RoutePermissionGuard>
        </div>
      </SidebarInset>
    </>
  );
}

function NavMenuItem({
  menu,
  pathname,
  onNavigate,
}: {
  menu: ApiMenu;
  pathname: string;
  onNavigate: () => void;
}) {
  const to = toAppPath(menu.route);
  const Icon = resolveMenuIcon(menu.icon);
  const children = menu.children ?? [];
  const hasChildren = children.length > 0;
  const exact = to === "/";
  const active = exact
    ? pathname === "/"
    : pathname === to || pathname.startsWith(`${to}/`);
  const childActive = children.some((c) => {
    const childTo = toAppPath(c.route);
    return pathname === childTo || pathname.startsWith(`${childTo}/`);
  });

  if (hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active || childActive}
          tooltip={menu.name}
          className={cn(
            "text-sidebar-foreground/75 hover:text-sidebar-foreground",
            (active || childActive) && "font-medium",
          )}
        >
          <Link to={to} onClick={onNavigate}>
            <Icon />
            <span>{menu.name}</span>
          </Link>
        </SidebarMenuButton>
        <SidebarMenuSub>
          {children.map((child) => {
            const childTo = toAppPath(child.route);
            const ChildIcon = resolveMenuIcon(child.icon);
            const childIsActive =
              pathname === childTo || pathname.startsWith(`${childTo}/`);
            return (
              <SidebarMenuSubItem key={child.id}>
                <SidebarMenuSubButton asChild isActive={childIsActive}>
                  <Link to={childTo} onClick={onNavigate}>
                    <ChildIcon />
                    <span>{child.name}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={menu.name}
        className={cn(
          "text-sidebar-foreground/75 hover:text-sidebar-foreground",
          active && "font-medium",
        )}
      >
        <Link to={to} onClick={onNavigate}>
          <Icon />
          <span>{menu.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
