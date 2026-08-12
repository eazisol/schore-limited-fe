import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Plus,
  Building2,
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

const statusChartConfig = {
  inProgress: { label: "In Progress", color: "var(--info)" },
  onHold: { label: "On Hold", color: "var(--warning)" },
  completed: { label: "Completed", color: "var(--success)" },
} satisfies ChartConfig;

const activityChartConfig = {
  count: { label: "Count", color: "var(--accent)" },
  activeProperties: { label: "Active Properties", color: "var(--info)" },
  delayed: { label: "Delayed Properties", color: "var(--destructive)" },
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

  const activityLineData = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "activeProperties",
        label: "Active Properties",
        count: data.activePropertiesCount,
      },
      {
        key: "delayed",
        label: "Delayed Properties",
        count: data.delayedPropertiesCount,
      },
    ];
  }, [data]);

  const extraCounts = useMemo(
    () => [
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
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left — Latest In Progress */}
            <section className="card-elevated flex min-h-0 flex-col overflow-hidden lg:col-span-8">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
                <div>
                  <h2 className="font-display font-semibold">Latest In Progress</h2>
                  <p className="text-xs text-muted-foreground">
                    Newest tasks with property and operatives
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/tasks">View all</Link>
                </Button>
              </div>

              {(data?.latestInProgressTasks ?? []).length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground sm:px-5">
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
                          <td className="px-3 py-3 text-muted-foreground">
                            {row.jobTypeName || "—"}
                          </td>
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
                    <ChartContainer
                      config={statusChartConfig}
                      className="mx-auto aspect-square h-[220px] w-full max-w-[260px]"
                    >
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel nameKey="key" />}
                        />
                        <Pie
                          data={statusPieData}
                          dataKey="value"
                          nameKey="key"
                          innerRadius={58}
                          outerRadius={88}
                          strokeWidth={2}
                          stroke="var(--color-card)"
                          paddingAngle={2}
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
                        <ChartLegend
                          content={<ChartLegendContent nameKey="key" />}
                          className="-translate-y-1 flex-wrap gap-2"
                        />
                      </PieChart>
                    </ChartContainer>
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

          {/* Full-width activity line chart */}
          <section className="card-elevated overflow-hidden">
            <div className="border-b px-4 py-3 sm:px-5">
              <h2 className="font-display font-semibold">Activity Snapshot</h2>
              <p className="text-xs text-muted-foreground">
                Active and delayed properties for this period
              </p>
            </div>
            <div className="px-2 pb-4 pt-3 sm:px-4">
              <ChartContainer config={activityChartConfig} className="h-[280px] w-full aspect-auto">
                <AreaChart
                  accessibilityLayer
                  data={activityLineData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Count"
                    stroke="var(--color-count)"
                    strokeWidth={2.5}
                    fill="url(#activityFill)"
                    dot={{
                      r: 4,
                      fill: "var(--color-count)",
                      stroke: "var(--color-card)",
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-card)" }}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          </section>
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
