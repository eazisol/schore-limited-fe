import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  HardHat,
  LogOut,
  UserCircle,
  PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { ROLE_BADGE, type UserRole } from "@/lib/users-store";
import { buildNavMenus } from "@/lib/authorization";
import { NavSidebarMenu } from "@/components/nav/NavSidebarMenu";
import type { ApiMenu } from "@/lib/api/services/auth";
import { RoutePermissionGuard } from "@/components/Permission";
import { AppTooltip } from "@/components/AppTooltip";
import { resolveProfileImageUrl, usersService } from "@/lib/api/services/users";
import type { ApiError } from "@/lib/api/axios";
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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function sessionGateAllowsShell(
  sessionCheck: {
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: unknown;
  },
  isAuthenticated: boolean,
): boolean {
  if (sessionCheck.isPending) return false;
  if (sessionCheck.isSuccess) return true;
  if (!sessionCheck.isError || !isAuthenticated) return false;

  const err = sessionCheck.error as ApiError | undefined;
  if (!err) return false;
  if (err.status === 401 || err.status === 403) return false;
  return err.isNetworkError || err.status >= 500;
}

export function AppShell() {
  const { user: authUser, isAuthenticated, signOut } = useAuth();
  const { menus, isLoading: permissionsLoading, error: permissionsError, refreshPermissions } =
    usePermissions();
  const queryClient = useQueryClient();

  // Validate the stored session against the server before rendering any
  // protected UI. A 401 clears the session (via the axios interceptor), so an
  // invalid token can never flash the dashboard before redirecting to sign-in.
  const sessionCheck = useQuery({
    queryKey: ["users", authUser?.id],
    queryFn: async () => (await usersService.get(authUser!.id)).data,
    enabled: !!authUser,
    staleTime: 60_000,
    retry: false,
  });

  if (!authUser) {
    return <AuthLoadingScreen />;
  }

  if (!sessionGateAllowsShell(sessionCheck, isAuthenticated)) {
    return <AuthLoadingScreen />;
  }

  if (permissionsLoading && menus.length === 0) {
    return <AuthLoadingScreen />;
  }

  if (permissionsError && menus.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="card-elevated max-w-md p-8 text-center">
          <div className="font-display font-semibold">Unable to load permissions</div>
          <p className="mt-1 text-sm text-muted-foreground">Please try again.</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              void refreshPermissions().catch(() => undefined);
            }}
          >
            Retry
          </Button>
        </div>
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
          queryClient.clear();
          signOut();
          toast.success("Signed out");
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
    avatar:
      resolveProfileImageUrl(profileQuery.data?.profileImagePath, profileQuery.data?.editDate) ||
      undefined,
  };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const locationHref = useRouterState({ select: (s) => s.location.href });
  const contentRef = useRef<HTMLDivElement>(null);
  const { setOpenMobile, state, isMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const navMenus = buildNavMenus(menus);

  useEffect(() => {
    const scrollToTop = () => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
        contentRef.current.scrollLeft = 0;
      }
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    scrollToTop();
    const frame = window.requestAnimationFrame(scrollToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [locationHref]);

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
           
            <SidebarGroupContent>
              <NavSidebarMenu menus={navMenus} pathname={pathname} onNavigate={closeMobileNav} />
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
              <AppTooltip content="Profile" asChild>
                <Link
                  to="/profile"
                  onClick={closeMobileNav}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-8 rounded-md border border-sidebar-border text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    collapsed && "size-8 p-0",
                  )}
                >
                  <UserCircle className="h-3.5 w-3.5" />
                  <span className={cn(collapsed && "sr-only")}>Profile</span>
                </Link>
              </AppTooltip>
              <AppTooltip content="Sign out" asChild>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileNav();
                    onSignOut();
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-8 rounded-md border border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive",
                    collapsed && "size-8 p-0",
                  )}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className={cn(collapsed && "sr-only")}>Sign out</span>
                </button>
              </AppTooltip>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh max-h-svh overflow-hidden">
        <header className="shrink-0 h-16 bg-background/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 lg:px-6">
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

        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto scrollbar-elegant px-4 pb-4 pt-2 lg:px-6 min-w-0"
        >
          <RoutePermissionGuard pathname={pathname}>
            <Outlet />
          </RoutePermissionGuard>
        </div>
      </SidebarInset>
    </>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  leading,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1">
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
