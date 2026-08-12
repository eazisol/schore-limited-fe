import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Plus,
  Building2,
  // HardHat, // Operatives on Site — kept for later
  AlertTriangle,
  Eye,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  dashboardService,
  type ApiDashboard,
  type DashboardPeriod,
} from "@/lib/api/services/dashboard";
import type { ApiError } from "@/lib/api/axios";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard | Schore" }] }),
  component: Dashboard,
});

export const dashboardQueryKey = ["dashboard"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashboardPeriod>("Daily");
  const [customFrom, setCustomFrom] = useState(monthStartIso);
  const [customTo, setCustomTo] = useState(todayIso);

  const query = useQuery({
    queryKey: [...dashboardQueryKey, period, customFrom, customTo],
    queryFn: async () =>
      (
        await dashboardService.get({
          period,
          ...(period === "Custom"
            ? { fromDate: customFrom, toDate: customTo }
            : {}),
        })
      ).data,
  });

  const data = query.data;
  const kpis = useMemo(
    () => [
      {
        label: "In Progress",
        value: data?.inProgressCount ?? 0,
        tone: "info" as const,
        icon: ClipboardList,
      },
      {
        label: "On Hold",
        value: data?.onHoldCount ?? 0,
        tone: "warn" as const,
        icon: Clock,
      },
      {
        label: "Completed / Handover",
        value: data?.completedCount ?? 0,
        tone: "ok" as const,
        icon: CheckCircle2,
      },
      {
        label: "New Tasks",
        value: data?.newTasksCount ?? 0,
        tone: "site" as const,
        icon: Plus,
      },
      {
        label: "Active Properties",
        value: data?.activePropertiesCount ?? 0,
        tone: "info" as const,
        icon: Building2,
      },
      // Operatives on Site — temporarily replaced by Delayed Properties
      // {
      //   label: "Operatives on Site",
      //   value: data?.operativesOnSiteCount ?? 0,
      //   tone: "site" as const,
      //   icon: HardHat,
      // },
      {
        label: "Delayed Properties",
        value: data?.delayedPropertiesCount ?? 0,
        tone: "destructive" as const,
        icon: AlertTriangle,
      },
    ],
    [data],
  );

  const periodLabel = formatPeriodLabel(period, data);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle={periodLabel}
        actions={
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(value) => {
                if (
                  value === "Daily" ||
                  value === "Monthly" ||
                  value === "Yearly" ||
                  value === "Custom"
                ) {
                  setPeriod(value);
                }
              }}
              variant="outline"
              size="sm"
              className="justify-start sm:justify-end"
              aria-label="Dashboard period"
            >
              <ToggleGroupItem value="Daily" aria-label="Daily">
                Daily
              </ToggleGroupItem>
              <ToggleGroupItem value="Monthly" aria-label="Monthly">
                Monthly
              </ToggleGroupItem>
              <ToggleGroupItem value="Yearly" aria-label="Yearly">
                Yearly
              </ToggleGroupItem>
              <ToggleGroupItem value="Custom" aria-label="Custom">
                Custom
              </ToggleGroupItem>
            </ToggleGroup>

            {period === "Custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="sr-only sm:not-sr-only">From</span>
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!next) return;
                      setCustomFrom(next);
                      if (customTo && next > customTo) setCustomTo(next);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none"
                    aria-label="Custom from date"
                  />
                </label>
                <span className="text-xs text-muted-foreground">to</span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="sr-only sm:not-sr-only">To</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!next) return;
                      setCustomTo(next);
                      if (customFrom && next < customFrom) setCustomFrom(next);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none"
                    aria-label="Custom to date"
                  />
                </label>
              </div>
            ) : null}
          </div>
        }
      />

      {query.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading dashboard…
        </div>
      ) : query.isError ? (
        <div className="card-elevated p-8 text-center">
          <p className="font-medium">Unable to load dashboard</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(query.error as unknown as ApiError)?.message || "Please try again."}
          </p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k) => (
              <Counter key={k.label} label={k.label} value={k.value} tone={k.tone} icon={k.icon} />
            ))}
          </div>

          <div className="card-elevated overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-display font-semibold">Latest In Progress</h2>
                <p className="text-xs text-muted-foreground">
                  Newest 5 tasks with property and operatives
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/tasks">View all</Link>
              </Button>
            </div>

            {(data?.latestInProgressTasks ?? []).length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">
                No in-progress tasks right now.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium sm:px-5">Task</th>
                      <th className="px-3 py-2.5 text-left font-medium">Property</th>
                      <th className="px-3 py-2.5 text-left font-medium">Operatives</th>
                      <th className="px-3 py-2.5 text-left font-medium">Type</th>
                      <th className="px-3 py-2.5 text-left font-medium">Start</th>
                      <th className="px-3 py-2.5 text-left font-medium">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium sm:px-5"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data!.latestInProgressTasks.map((row) => (
                      <tr key={row.taskId} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium tabular-nums sm:px-5">
                          {row.taskNumber}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.propertyName}</div>
                          {row.propertyAddress ? (
                            <div className="mt-0.5 max-w-[14rem] truncate text-xs text-muted-foreground">
                              {row.propertyAddress}
                            </div>
                          ) : null}
                        </td>
                        <td className="max-w-[12rem] px-3 py-3 text-muted-foreground">
                          <span className="line-clamp-2">{row.operativesDisplay || "—"}</span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{row.jobTypeName || "—"}</td>
                        <td className="px-3 py-3 tabular-nums text-muted-foreground">
                          {formatShortDate(row.startDate)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={row.statusName || row.statusCode} />
                        </td>
                        <td className="px-4 py-3 text-right sm:px-5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() =>
                              navigate({
                                to: "/tasks/$id",
                                params: { id: String(row.taskId) },
                                search: { mode: "view" },
                              })
                            }
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View task</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatPeriodLabel(period: DashboardPeriod, data?: ApiDashboard) {
  if (!data?.fromDate) {
    return period === "Daily"
      ? "Today's snapshot"
      : period === "Monthly"
        ? "This month"
        : period === "Yearly"
          ? "This year"
          : "Custom range";
  }

  const from = formatShortDate(data.fromDate);
  const to = formatShortDate(data.toDate);
  if (period === "Daily") return `Stats for ${from}`;
  return `Stats for ${from} – ${to}`;
}

function formatShortDate(iso: string) {
  const day = iso.slice(0, 10);
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Counter({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "info" | "warn" | "ok" | "site" | "destructive";
  icon: LucideIcon;
}) {
  const toneCls =
    tone === "warn"
      ? "text-warning-foreground"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "info"
          ? "text-info"
          : tone === "site"
            ? "text-accent"
            : "text-success";
  const iconWrapCls =
    tone === "warn"
      ? "bg-warning/20 text-warning-foreground"
      : tone === "destructive"
        ? "bg-destructive/10 text-destructive"
        : tone === "info"
          ? "bg-info/10 text-info"
          : tone === "site"
            ? "bg-accent/15 text-accent"
            : "bg-success/10 text-success";
  const borderCls =
    tone === "warn"
      ? "border-l-warning"
      : tone === "destructive"
        ? "border-l-destructive"
        : tone === "info"
          ? "border-l-info"
          : tone === "site"
            ? "border-l-accent"
            : "border-l-success";
  return (
    <div className={cn("card-elevated flex items-center gap-3 border-l-4 p-3 sm:p-4", borderCls)}>
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", iconWrapCls)}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("mt-0.5 font-display text-2xl font-semibold tabular-nums", toneCls)}>
          {value}
        </div>
      </div>
    </div>
  );
}
