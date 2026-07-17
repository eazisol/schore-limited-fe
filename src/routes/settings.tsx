import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { buildSettingsTabs, hasSettingsAccess } from "@/lib/authorization";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings | Schore" }] }),
  component: SettingsLayout,
});

function SettingsLayout() {
  const { isAuthenticated } = useAuth();
  const { menus } = usePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  // Memoize so `tabs` keeps the same reference unless `menus` actually changes.
  // Without this, `buildSettingsTabs` returns a new array every render, which
  // would cause any useEffect that lists `tabs` as a dependency to re-fire on
  // every single render — the first half of the original loop.
  const tabs = useMemo(() => buildSettingsTabs(menus), [menus]);
  const canAccessSettings = useMemo(() => hasSettingsAccess(menus), [menus]);

  // Keep the latest `navigate` in a ref so it is never listed as a useEffect
  // dependency. TanStack Router does not guarantee `navigate` is referentially
  // stable across renders; listing it in deps caused the effect to re-fire on
  // every render, which was the second half of the original loop.
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });

  // Single, deterministic guard — replaces the two competing effects that
  // previously fought each other during navigation transitions:
  //   • Effect A redirected /settings → first tab
  //   • Effect B saw an incomplete pathname mid-transition and immediately
  //     redirected to /forbidden, cancelling Effect A's navigation
  useEffect(() => {
    if (!isAuthenticated) return;

    const nav = navigateRef.current;

    if (!canAccessSettings) {
      nav({ to: "/forbidden" });
      return;
    }

    // /settings (exact) → redirect to first available tab
    if (pathname === "/settings" || pathname === "/settings/") {
      const first = tabs[0];
      if (first) nav({ to: first.to, replace: true });
      else nav({ to: "/forbidden" });
      return;
    }

    // /settings/* — if this specific sub-path has no matching tab, deny access
    if (pathname.startsWith("/settings/")) {
      const allowed = tabs.some(
        (t) => pathname === t.to || pathname.startsWith(`${t.to}/`),
      );
      if (!allowed) nav({ to: "/forbidden" });
    }
  // `navigate` is intentionally excluded — see navigateRef comment above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, canAccessSettings, pathname, tabs]);

  if (!isAuthenticated || !canAccessSettings || tabs.length === 0) return null;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle=""
      />
      <div className="border-b mb-2">
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(`${t.to}/`);
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
