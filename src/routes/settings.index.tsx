import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { usePermissions } from "@/contexts/PermissionContext";
import { getSettingsChildMenus, hasSettingsAccess } from "@/lib/authorization";

/**
 * Settings is a sidebar container (like Product Management).
 * Redirect to the first readable Settings child from the Menu API.
 */
export const Route = createFileRoute("/settings/")({
  head: () => ({ meta: [{ title: "Settings | Schore" }] }),
  component: SettingsIndex,
});

function SettingsIndex() {
  const navigate = useNavigate();
  const { menus } = usePermissions();
  const canAccess = useMemo(() => hasSettingsAccess(menus), [menus]);
  const children = useMemo(() => getSettingsChildMenus(menus), [menus]);
  const firstRoute = children[0]?.route;

  useEffect(() => {
    if (!canAccess) {
      navigate({ to: "/forbidden", replace: true });
      return;
    }
    if (firstRoute) {
      navigate({ to: firstRoute, replace: true });
    }
  }, [canAccess, firstRoute, navigate]);

  if (!canAccess || firstRoute) return null;

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="card-elevated p-12 text-center text-sm text-muted-foreground">
        No settings modules are available for your account.
      </div>
    </div>
  );
}
