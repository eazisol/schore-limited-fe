import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { UserDetailPage } from "@/components/users/UserDetailPage";
import { OPERATIVE_VIEW_TABS } from "@/lib/operative-view-tabs";
import { Loader2 } from "lucide-react";

const operativeMeSearchSchema = z.object({
  viewTab: z.enum(OPERATIVE_VIEW_TABS).optional(),
});

export const Route = createFileRoute("/operatives/me")({
  head: () => ({ meta: [{ title: "Dashboard | Schore" }] }),
  validateSearch: operativeMeSearchSchema,
  component: OperativeMeDashboard,
});

function OperativeMeDashboard() {
  const { user, isHydrated } = useAuth();

  if (!isHydrated) {
    return (
      <div className="flex items-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!user?.id) {
    throw redirect({ to: "/signin", replace: true });
  }

  return <UserDetailPage selfViewUserId={user.id} />;
}
