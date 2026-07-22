import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { usePermissions } from "@/contexts/PermissionContext";
import { getProductChildMenus, hasProductAccess } from "@/lib/authorization";

/**
 * Product is a sidebar container (like Settings).
 * Redirect to the first readable Product child from the Menu API.
 */
export const Route = createFileRoute("/product/")({
  head: () => ({ meta: [{ title: "Product | Schore" }] }),
  component: ProductIndex,
});

function ProductIndex() {
  const navigate = useNavigate();
  const { menus } = usePermissions();
  const canAccess = useMemo(() => hasProductAccess(menus), [menus]);
  const children = useMemo(() => getProductChildMenus(menus), [menus]);
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
      <PageHeader title="Product" />
      <div className="card-elevated p-12 text-center text-sm text-muted-foreground">
        No product modules are available for your account.
      </div>
    </div>
  );
}
