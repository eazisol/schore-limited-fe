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
import { resolveProfileImageUrl, usersService } from "@/lib/api/services/users";
import type { ApiError } from "@/lib/api/axios";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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

          <div className="ml-auto flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                toast("No new notifications", { description: "You're all caught up." })
              }
              className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Account menu"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/90 text-xs font-semibold text-accent-foreground">
                      {initials}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          roleBadgeClass,
                        )}
                      >
                        {user.role}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <UserCircle />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onSignOut}
                  className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-elegant px-4 pb-4 pt-2 lg:px-6 min-w-0"
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
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-2">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-display text-xl font-semibold tracking-tight sm:truncate sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground sm:truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
