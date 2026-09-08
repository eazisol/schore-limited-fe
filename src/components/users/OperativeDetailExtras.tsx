import { Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Label, Pie, PieChart } from "recharts";
import { CheckCircle2, ClipboardList, Clock, Eye, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  resolveProfileImageUrl,
  toDateInputValue,
  type ApiUser,
} from "@/lib/api/services/users";
import { tasksService } from "@/lib/api/services/tasks";
import { formatDailyRate } from "@/lib/module-ui";
import { IN_PROGRESS_STATUS_CODE } from "@/lib/hold";
import { isNonEmptyId } from "@/lib/ids";
import { cn } from "@/lib/utils";

const PENDING_STATUS_CODE = "PENDING";
const COMPLETED_STATUS_CODE = "COMPLETED";

const TAB_TRIGGER_CLASS =
  "h-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 shadow-none data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:border-primary";

const taskStatusChartConfig = {
  pending: { label: "Pending", color: "var(--warning)" },
  inProgress: { label: "In Progress", color: "var(--info)" },
  completed: { label: "Completed", color: "var(--success)" },
} satisfies ChartConfig;

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-3 sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="text-sm font-medium sm:col-span-2">{value || "—"}</dd>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <p className="px-1 py-8 text-center text-sm text-muted-foreground">{message}</p>
  );
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

export function OperativeDetailExtras({ user }: { user: ApiUser }) {
  const operativeId = String(user.id);

  const tasksQuery = useQuery({
    queryKey: ["tasks", "operative", operativeId],
    queryFn: async () =>
      (
        await tasksService.list({
          page: 1,
          pageSize: 100,
          operativeId,
          sortBy: "startdate",
          sortDir: "desc",
        })
      ).data,
    enabled: isNonEmptyId(operativeId),
  });

  const tasks = tasksQuery.data?.items ?? [];

  const statusCounts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    for (const task of tasks) {
      const code = (task.statusCode ?? "").toUpperCase();
      if (code === PENDING_STATUS_CODE) pending += 1;
      else if (code === IN_PROGRESS_STATUS_CODE) inProgress += 1;
      else if (code === COMPLETED_STATUS_CODE) completed += 1;
    }
    return {
      total: tasksQuery.data?.totalCount ?? tasks.length,
      pending,
      inProgress,
      completed,
    };
  }, [tasks, tasksQuery.data?.totalCount]);

  const statusPieData = useMemo(
    () =>
      [
        {
          key: "pending",
          name: "Pending",
          value: statusCounts.pending,
          fill: "var(--color-pending)",
        },
        {
          key: "inProgress",
          name: "In Progress",
          value: statusCounts.inProgress,
          fill: "var(--color-inProgress)",
        },
        {
          key: "completed",
          name: "Completed",
          value: statusCounts.completed,
          fill: "var(--color-completed)",
        },
      ].filter((d) => d.value > 0),
    [statusCounts],
  );

  const pieTotal =
    statusCounts.pending + statusCounts.inProgress + statusCounts.completed;

  const tradeNames = useMemo(() => {
    if (user.tradeNames?.length) return user.tradeNames.filter(Boolean);
    if (user.tradeName?.trim()) {
      return user.tradeName.split(",").map((n) => n.trim()).filter(Boolean);
    }
    return [];
  }, [user.tradeName, user.tradeNames]);

  const certifications = user.certifications ?? [];
  const rateOverrides = user.rateOverrides ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
      <section className="card-elevated min-w-0 overflow-hidden lg:col-span-8">
        <Tabs defaultValue="tasks" className="flex min-w-0 flex-col">
          <div className="overflow-x-auto border-b px-3 pt-1 sm:px-4">
            <TabsList className="inline-flex h-auto w-max min-w-full flex-row items-start justify-start gap-1 rounded-none bg-transparent p-0 pb-0 sm:gap-2">
              <TabsTrigger value="tasks" className={TAB_TRIGGER_CLASS}>
                Tasks
              </TabsTrigger>
              <TabsTrigger value="bank" className={TAB_TRIGGER_CLASS}>
                Bank details
              </TabsTrigger>
              <TabsTrigger value="certificates" className={TAB_TRIGGER_CLASS}>
                Certificates
              </TabsTrigger>
              <TabsTrigger value="trades" className={TAB_TRIGGER_CLASS}>
                Trades
              </TabsTrigger>
              <TabsTrigger value="rates" className={TAB_TRIGGER_CLASS}>
                Rates
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
            {tasksQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tasks…
              </div>
            ) : tasksQuery.isError ? (
              <EmptyPanel message="Unable to load tasks for this operative." />
            ) : tasks.length === 0 ? (
              <EmptyPanel message="No tasks assigned to this operative." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Job</th>
                      <th className="px-3 py-2.5 text-left font-medium">Property</th>
                      <th className="px-3 py-2.5 text-left font-medium">Type</th>
                      <th className="px-3 py-2.5 text-left font-medium">Start</th>
                      <th className="px-3 py-2.5 text-left font-medium">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums">
                          {task.taskNumber}
                        </td>
                        <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">
                          {task.propertyName}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {task.jobTypeName || "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                          {formatShortDate(task.startDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={task.statusName || task.statusCode} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                            <Link
                              to="/tasks/$id"
                              params={{ id: String(task.id) }}
                              search={{ mode: "view" }}
                              aria-label={`View ${task.taskNumber}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bank" className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5">
            <dl className="divide-y divide-border">
              <DetailRow label="Account holder" value={user.accountHolderName?.trim()} />
              <DetailRow label="Bank name" value={user.bankName?.trim()} />
              <DetailRow label="Sort code" value={user.sortCode?.trim()} />
              <DetailRow label="Account number" value={user.accountNumber?.trim()} />
            </dl>
          </TabsContent>

          <TabsContent
            value="certificates"
            className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5"
          >
            {certifications.length === 0 ? (
              <EmptyPanel message="No certificates on file." />
            ) : (
              <ul className="divide-y divide-border">
                {certifications.map((cert) => (
                  <li
                    key={cert.id ?? `${cert.certificationTypeId}-${cert.startDate}`}
                    className="flex flex-col gap-1 py-2.5 text-sm"
                  >
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {cert.certificationTypeName || "Certification"}
                          {cert.certificationLevelName
                            ? ` · ${cert.certificationLevelName}`
                            : ""}
                        </p>
                        {cert.notes?.trim() ? (
                          <p className="text-xs text-muted-foreground">{cert.notes}</p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {toDateInputValue(cert.startDate)} → {toDateInputValue(cert.expiryDate)}
                      </p>
                    </div>
                    {(cert.files?.length ?? 0) > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {cert.files!.map((file) => (
                          <li key={file.id}>
                            <a
                              href={resolveProfileImageUrl(file.filePath)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-info hover:underline"
                            >
                              {file.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="trades" className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5">
            <dl className="divide-y divide-border">
              <DetailRow
                label="Trades"
                value={
                  tradeNames.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {tradeNames.map((name) => (
                        <li
                          key={name}
                          className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-medium"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow label="CIS" value={user.cisName?.trim()} />
              <DetailRow
                label="Is daily rate"
                value={user.isDailyRate ? "Yes" : "No"}
              />
            </dl>
          </TabsContent>

          <TabsContent value="rates" className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5">
            <dl className="mb-3 divide-y divide-border">
              <DetailRow label="Daily rate" value={formatDailyRate(user.dailyRate)} />
            </dl>
            {rateOverrides.length === 0 ? (
              <EmptyPanel message="No agreed rate overrides. Catalogue rates apply." />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Product</th>
                      <th className="px-3 py-2 text-right font-medium">Rate</th>
                      <th className="px-3 py-2 text-left font-medium">Effective from</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rateOverrides.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-medium">{row.productName || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatDailyRate(row.rate)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatShortDate(row.effectiveFrom)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <section className="flex flex-col gap-4 lg:col-span-4">
        <div className="card-elevated overflow-hidden">
          <div className="border-b px-4 py-3 sm:px-5">
            <h2 className="font-display font-semibold">Task status</h2>
            <p className="text-xs text-muted-foreground">
              Pending, in progress and completed for this operative
            </p>
          </div>

          <div className="px-4 pb-2 pt-4 sm:px-5">
            {tasksQuery.isLoading ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : pieTotal === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No task status data yet.
              </div>
            ) : (
              <ChartContainer
                config={taskStatusChartConfig}
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
                                {statusCounts.total}
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
            {(
              [
                {
                  key: "pending",
                  label: "Pending",
                  value: statusCounts.pending,
                  tone: "warn" as const,
                  icon: Clock,
                },
                {
                  key: "inProgress",
                  label: "In progress",
                  value: statusCounts.inProgress,
                  tone: "info" as const,
                  icon: ClipboardList,
                },
                {
                  key: "completed",
                  label: "Completed",
                  value: statusCounts.completed,
                  tone: "ok" as const,
                  icon: CheckCircle2,
                },
              ] as const
            ).map((item) => (
              <div
                key={item.key}
                className={cn(
                  "rounded-lg border px-2 py-2 text-center",
                  item.tone === "warn" && "border-warning/20 bg-warning/5",
                  item.tone === "info" && "border-info/20 bg-info/5",
                  item.tone === "ok" && "border-success/20 bg-success/5",
                )}
              >
                <item.icon
                  className={cn(
                    "mx-auto mb-1 h-3.5 w-3.5",
                    item.tone === "warn" && "text-warning-foreground",
                    item.tone === "info" && "text-info",
                    item.tone === "ok" && "text-success",
                  )}
                />
                <div className="font-display text-base font-semibold tabular-nums">
                  {item.value}
                </div>
                <div className="text-[10px] text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
