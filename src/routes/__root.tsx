import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, redirect, useNavigate, useRouter, useRouterState, HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ApiProvider } from "@/contexts/ApiContext";
import { PermissionProvider, usePermissions } from "@/contexts/PermissionContext";
import { getDefaultHomePath, isPublicPath } from "@/lib/authorization";
import { DAILY_ROUTE } from "@/lib/daily";
import { isOperativeUserType } from "@/lib/operative-portal";
import { isLabourPlanner } from "@/lib/roles";
import { AUTH_BOOTSTRAP_SCRIPT, getStoredSession } from "@/lib/session";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This screen doesn't exist in the Schore platform.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Try again</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent/10">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    if (isPublicPath(location.pathname)) return;
    if (!getStoredSession()) {
      const redirectTo = `${location.pathname}${location.search}`;
      throw redirect({
        to: "/signin",
        search: { redirect: redirectTo.startsWith("/") ? redirectTo : "/" },
        replace: true,
      });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Schore Limited | Workforce & Payroll Platform" },
      { name: "description", content: "Digitised workforce, daily programme and weekly pay management for Schore Limited." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Runs before paint — no Dashboard flash when logged out */}
        <script dangerouslySetInnerHTML={{ __html: AUTH_BOOTSTRAP_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

const AUTH_ROUTES = ["/signin", "/forgot-password", "/reset-password"] as const;

function AppRouter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const { menus } = usePermissions();
  const isAuthRoute = AUTH_ROUTES.includes(pathname as (typeof AUTH_ROUTES)[number]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated && !isPublicPath(pathname)) {
      navigate({ to: "/signin", replace: true });
      return;
    }
    if (isAuthenticated && pathname === "/signin") {
      const home = isOperativeUserType(user?.userTypeCode)
        ? "/operatives/me"
        : isLabourPlanner(user?.roles)
          ? DAILY_ROUTE
          : menus.length > 0
            ? getDefaultHomePath(menus, user?.roles)
            : "/";
      navigate({ to: home, replace: true });
    }
  }, [isHydrated, isAuthenticated, pathname, navigate, user?.userTypeCode, user?.roles, menus]);

  // Never paint protected UI until we know session state.
  if (!isHydrated) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return isAuthRoute ? <Outlet /> : <AuthLoadingScreen />;
  }

  if (isAuthRoute) {
    return <AuthLoadingScreen />;
  }

  return <AppShell />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <AuthProvider>
          <PermissionProvider>
            <AppRouter />
            <Toaster position="bottom-right" />
          </PermissionProvider>
        </AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

