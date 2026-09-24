import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { UserDetailPage } from "@/components/users/UserDetailPage";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/operatives/me")({
  head: () => ({ meta: [{ title: "Dashboard | Schore" }] }),
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
