import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { buildNavMenus, toAppPath } from "@/lib/authorization";

export const Route = createFileRoute("/forbidden")({
  head: () => ({ meta: [{ title: "Access denied — Schore" }] }),
  component: Forbidden,
});

function Forbidden() {
  const { menus } = useAuth();
  const firstReadable = buildNavMenus(menus)[0];
  const safeTo = firstReadable ? toAppPath(firstReadable.route) : "/profile";

  return (
    <div>
      <PageHeader title="Access denied" subtitle="You don't have permission to view this page." />
      <div className="card-elevated p-10 grid place-items-center text-center max-w-xl mx-auto">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h2 className="mt-4 font-display text-xl font-semibold">403 — Forbidden</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen is restricted by your role. If you believe you need access, please contact your administrator.
        </p>
        <Button asChild className="mt-6">
          <Link to={safeTo}>
            <ArrowLeft className="h-4 w-4" />
            {firstReadable ? `Go to ${firstReadable.name}` : "Go to profile"}
          </Link>
        </Button>
      </div>
    </div>
  );
}
