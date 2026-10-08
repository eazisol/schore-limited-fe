import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { ActivitySnapshotChart } from "@/components/dashboard/ActivitySnapshotChart";
import { DashboardPeriodFilter } from "@/components/dashboard/DashboardPeriodFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Cell, Label, Pie, PieChart } from "recharts";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Plus,
  Building2,
  AlertTriangle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  dashboardService,
  type ApiDashboard,
  type DashboardPeriod,
  type DashboardQueryParams,
} from "@/lib/api/services/dashboard";
import { mapActivityPoints } from "@/lib/dashboard-activity";
import type { ApiError } from "@/lib/api/axios";
import { usePermissions } from "@/contexts/PermissionContext";
import { canAccessPath } from "@/lib/authorization";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard | Schore" }] }),
  component: Dashboard,
});

export const dashboardQueryKey = ["dashboard"] as const;
export const dashboardActivityQueryKey = ["dashboard", "activity"] as const;

const statusChartConfig = {
  inProgress: { label: "In Progress", color: "var(--info)" },
  onHold: { label: "On Hold", color: "var(--warning)" },
  completed: { label: "Completed", color: "var(--success)" },
} satisfies ChartConfig;

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
  const { menus, isLoading: permissionsLoading } = usePermissions();
  const canReadDashboard =
    !permissionsLoading && menus.length > 0 && canAccessPath(menus, "/");
  const [period, setPeriod] = useState<DashboardPeriod>("Daily");
  const [customFrom, setCustomFrom] = useState(monthStartIso);
  const [customTo, setCustomTo] = useState(todayIso);

  const queryParams = useMemo<DashboardQueryParams>(
    () => ({
      period,
      ...(period === "Custom" ? { fromDate: customFrom, toDate: customTo } : {}),
    }),
    [period, customFrom, customTo],
  );

  const query = useQuery({
    queryKey: [...dashboardQueryKey, queryParams],
    queryFn: async () => (await dashboardService.get(queryParams)).data,
    placeholderData: keepPreviousData,
    enabled: canReadDashboard,
  });

  const activityQuery = useQuery({
    queryKey: [...dashboardActivityQueryKey, queryParams],
    queryFn: async () => (await dashboardService.getActivity(queryParams)).data,
    placeholderData: keepPreviousData,
    enabled: canReadDashboard,
  });

  const data = query.data;

  const statusPieData = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "inProgress",
        name: "In Progress",
        value: data.inProgressCount,
        fill: "var(--color-inProgress)",
      },
      {
        key: "onHold",
        name: "On Hold",
        value: data.onHoldCount,
        fill: "var(--color-onHold)",
      },
      {
        key: "completed",
        name: "Completed",
        value: data.completedCount,
        fill: "var(--color-completed)",
      },
    ].filter((d) => d.value > 0);
  }, [data]);

  const statusTotal = useMemo(
    () =>
      (data?.inProgressCount ?? 0) +
      (data?.onHoldCount ?? 0) +
      (data?.completedCount ?? 0),
    [data],
  );

  const statusCounts = useMemo(
    () => [
      {
        key: "inProgress",
        label: "In Progress",
        value: data?.inProgressCount ?? 0,
        tone: "info" as const,
        icon: ClipboardList,
      },
      {
        key: "onHold",
        label: "On Hold",
        value: data?.onHoldCount ?? 0,
        tone: "warn" as const,
        icon: Clock,
      },
      {
        key: "completed",
        label: "Completed",
        value: data?.completedCount ?? 0,
        tone: "ok" as const,
        icon: CheckCircle2,
      },
    ],
    [data],
  );

  const activityLineData = useMemo(
    () =>
      mapActivityPoints(
        activityQuery.data?.points ?? [],
        period,
        activityQuery.data?.fromDate ?? data?.fromDate,
        activityQuery.data?.toDate ?? data?.toDate,
      ),
    [activityQuery.data?.points, activityQuery.data?.fromDate, activityQuery.data?.toDate, period, data?.fromDate, data?.toDate],
  );

  const extraCounts = useMemo(
    () => [
      {
        label: "New Jobs",
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
          <DashboardPeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(from, to) => {
              setCustomFrom(from);
              setCustomTo(to);
            }}
            fetching={query.isFetching || activityQuery.isFetching}
          />
        }
      />

      {query.isLoading && !query.isPlaceholderData ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading dashboard…
        </div>
      ) : query.isError && !data ? (
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
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left — Latest In Progress */}
            <section className="card-elevated flex min-h-0 flex-col overflow-hidden lg:col-span-8">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
                <div>
                  <h2 className="font-display font-semibold">Latest In Progress</h2>
                  <p className="text-xs text-muted-foreground">
                    Newest jobs with property and operatives
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/tasks">View all</Link>
                </Button>
              </div>

              {(data?.latestInProgressTasks ?? []).length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground sm:px-5">
                  No in-progress jobs right now.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium sm:px-5">Job</th>
                        <th className="px-3 py-2.5 text-left font-medium">Property</th>
                        <th className="px-3 py-2.5 text-left font-medium">Operatives</th>
                        <th className="px-3 py-2.5 text-left font-medium">Type</th>
                        <th className="px-3 py-2.5 text-left font-medium">Start</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-left font-medium">Status</th>
                        <th className="px-4 py-2.5 text-right font-medium sm:px-5">Action</th>
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
                          <td className="px-3 py-3 text-muted-foreground">
                            {row.jobTypeName || "—"}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted-foreground">
                            {formatShortDate(row.startDate)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <StatusBadge status={row.statusName || row.statusCode} />
                          </td>
                          <td className="px-4 py-3 text-right sm:px-5">
                            <button
                              type="button"
                              className="text-sm text-accent underline underline-offset-2 hover:text-accent/80"
                              onClick={() =>
                                navigate({
                                  to: "/tasks/$id",
                                  params: { id: row.taskId },
                                  search: { mode: "view" },
                                })
                              }
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Right — Status pie + counts */}
            <section className="flex flex-col gap-4 lg:col-span-4">
              <div className="card-elevated overflow-hidden">
                <div className="border-b px-4 py-3 sm:px-5">
                  <h2 className="font-display font-semibold">Status Overview</h2>
                  <p className="text-xs text-muted-foreground">
                    Task status mix for this period
                  </p>
                </div>

                <div className="px-4 pb-2 pt-4 sm:px-5">
                  {statusTotal === 0 ? (
                    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                      No status data for this period.
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ChartContainer
                        config={statusChartConfig}
                        className="aspect-square h-[200px] w-[200px] shrink-0 overflow-visible"
                      >
                        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel nameKey="key" />}
                          />
                          <Pie
                            data={statusPieData}
                            dataKey="value"
                            nameKey="key"
                            innerRadius="58%"
                            outerRadius="88%"
                            strokeWidth={2}
                            stroke="var(--color-card)"
                            paddingAngle={2}
                            isAnimationActive={false}
                          >
                            {statusPieData.map((entry) => (
                              <Cell key={entry.key} fill={entry.fill} />
                            ))}
                            <Label
                              content={({ viewBox }) => {
                                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                  return (
                                    <text
                                      x={viewBox.cx}
                                      y={viewBox.cy}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                    >
                                      <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy ?? 0) - 6}
                                        className="fill-foreground font-display text-2xl font-semibold"
                                      >
                                        {statusTotal}
                                      </tspan>
                                      <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy ?? 0) + 14}
                                        className="fill-muted-foreground text-[11px]"
                                      >
                                        Total
                                      </tspan>
                                    </text>
                                  );
                                }
                                return null;
                              }}
                            />
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-2">
                        {statusPieData.map((entry) => (
                          <div
                            key={entry.key}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              style={{
                                backgroundColor:
                                  statusChartConfig[entry.key as keyof typeof statusChartConfig]
                                    .color,
                              }}
                            />
                            <span>{entry.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t p-3 sm:p-4">
                  {statusCounts.map((s) => (
                    <StatusCount
                      key={s.key}
                      label={s.label}
                      value={s.value}
                      tone={s.tone}
                      icon={s.icon}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {extraCounts.map((k) => (
                  <MiniCount
                    key={k.label}
                    label={k.label}
                    value={k.value}
                    tone={k.tone}
                    icon={k.icon}
                  />
                ))}
              </div>
            </section>
          </div>

          {activityQuery.isLoading && !activityQuery.isPlaceholderData ? (
            <section className="card-elevated flex h-[300px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading activity history…
            </section>
          ) : activityQuery.isError && !activityQuery.data ? (
            <section className="card-elevated p-8 text-center">
              <p className="font-medium">Unable to load activity history</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(activityQuery.error as unknown as ApiError)?.message || "Please try again."}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                onClick={() => void activityQuery.refetch()}
              >
                Retry
              </Button>
            </section>
          ) : (
            <ActivitySnapshotChart
              data={activityLineData}
              subtitle={
                period === "Yearly"
                  ? "Monthly history for the selected year"
                  : "Daily history for the selected period"
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function formatPeriodLabel(period: DashboardPeriod, data?: ApiDashboard) {
  const range =
    data?.fromDate && data.period === period
      ? { from: data.fromDate, to: data.toDate }
      : undefined;

  if (!range) {
    return period === "Daily"
      ? "Today's snapshot"
      : period === "Weekly"
        ? "This week"
        : period === "Monthly"
          ? "This month"
          : period === "Yearly"
            ? "This year"
            : "Custom range";
  }

  const from = formatShortDate(range.from);
  const to = formatShortDate(range.to);
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

function StatusCount({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "info" | "warn" | "ok";
  icon: LucideIcon;
}) {
  const toneCls =
    tone === "warn"
      ? "text-warning-foreground"
      : tone === "info"
        ? "text-info"
        : "text-success";
  const iconWrapCls =
    tone === "warn"
      ? "bg-warning/20 text-warning-foreground"
      : tone === "info"
        ? "bg-info/10 text-info"
        : "bg-success/10 text-success";

  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2.5 text-center sm:text-left">
      <div className="flex items-center justify-center gap-1.5 sm:justify-start">
        <span className={cn("grid h-6 w-6 place-items-center rounded-md", iconWrapCls)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">{label}</span>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground sm:hidden">{label}</div>
      <div className={cn("mt-0.5 font-display text-xl font-semibold tabular-nums", toneCls)}>
        {value}
      </div>
    </div>
  );
}

function MiniCount({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "info" | "site" | "destructive";
  icon: LucideIcon;
}) {
  const toneCls =
    tone === "destructive"
      ? "text-destructive"
      : tone === "site"
        ? "text-accent"
        : "text-info";
  const iconWrapCls =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "site"
        ? "bg-accent/15 text-accent"
        : "bg-info/10 text-info";

  return (
    <div className="card-elevated flex flex-col gap-2 p-3">
      <div className={cn("grid h-8 w-8 place-items-center rounded-lg", iconWrapCls)}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
        <div className={cn("mt-0.5 font-display text-xl font-semibold tabular-nums", toneCls)}>
          {value}
        </div>
      </div>
    </div>
  );
}
