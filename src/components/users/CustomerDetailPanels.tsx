import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Label, Pie, PieChart } from "recharts";
import { CheckCircle2, ClipboardList, Clock, Loader2 } from "lucide-react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EntityHierarchyCard } from "@/components/hierarchy/EntityHierarchyCard";
import { CustomerCostBudgetCard } from "@/components/users/CustomerDetailExtras";
import { type ApiUser } from "@/lib/api/services/users";
import { tasksService } from "@/lib/api/services/tasks";
import {
  DOCUMENT_TYPE_CODE,
  statusesService,
} from "@/lib/api/services/statuses";
import { IN_PROGRESS_STATUS_CODE } from "@/lib/hold";
import { isNonEmptyId } from "@/lib/ids";
import { cn } from "@/lib/utils";

const PENDING_STATUS_CODE = "PENDING";
const COMPLETED_STATUS_CODE = "COMPLETED";

const taskStatusChartConfig = {
  pending: { label: "Pending", color: "var(--warning)" },
  inProgress: { label: "In Progress", color: "var(--info)" },
  completed: { label: "Completed", color: "var(--success)" },
} satisfies ChartConfig;

export function CustomerDetailExtrasPanel({
  user,
  customerId,
  customerLabel,
  onAddRates,
}: {
  user: ApiUser;
  customerId: string;
  customerLabel?: string;
  onAddRates?: () => void;
}) {
  const statusesQuery = useQuery({
    queryKey: ["statuses", "task", "options"],
    queryFn: async () =>
      (
        await statusesService.list({
          documentTypeCode: DOCUMENT_TYPE_CODE.TASK,
          pageSize: 50,
        })
      ).data,
    enabled: isNonEmptyId(customerId),
  });

  const statusIds = useMemo(() => {
    const list = statusesQuery.data?.items ?? [];
    return {
      pending: list.find((s) => s.code === PENDING_STATUS_CODE)?.id ?? null,
      inProgress: list.find((s) => s.code === IN_PROGRESS_STATUS_CODE)?.id ?? null,
      completed: list.find((s) => s.code === COMPLETED_STATUS_CODE)?.id ?? null,
    };
  }, [statusesQuery.data]);

  const countsQuery = useQuery({
    queryKey: [
      "tasks",
      "customer-counts",
      customerId,
      statusIds.pending,
      statusIds.inProgress,
      statusIds.completed,
    ],
    queryFn: async () => {
      const count = async (statusId?: string | null) => {
        const data = (
          await tasksService.list({
            page: 1,
            pageSize: 1,
            customerId,
            ...(statusId ? { statusId } : {}),
          })
        ).data;
        return data.totalCount;
      };
      const [total, pending, inProgress, completed] = await Promise.all([
        count(),
        statusIds.pending ? count(statusIds.pending) : Promise.resolve(0),
        statusIds.inProgress ? count(statusIds.inProgress) : Promise.resolve(0),
        statusIds.completed ? count(statusIds.completed) : Promise.resolve(0),
      ]);
      return { total, pending, inProgress, completed };
    },
    enabled:
      isNonEmptyId(customerId) &&
      !statusesQuery.isLoading &&
      (statusIds.pending != null ||
        statusIds.inProgress != null ||
        statusIds.completed != null),
  });

  const statusCounts = countsQuery.data ?? {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  };

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
  const chartLoading = statusesQuery.isLoading || countsQuery.isLoading;

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
      <div className="min-w-0 lg:col-span-8">
        <EntityHierarchyCard
          scope="customer"
          customerId={customerId}
          customerLabel={customerLabel}
          title="Client work"
          includeJobTabs
          rateOverrides={user.rateOverrides}
          onAddRates={onAddRates}
        />
      </div>

      <section className="flex flex-col gap-4 lg:col-span-4">
        <div className="card-elevated overflow-hidden">
          <div className="border-b px-4 py-3 sm:px-5">
            <h2 className="font-display font-semibold">Task status</h2>
            <p className="text-xs text-muted-foreground">
              Pending, in progress and completed for this client
            </p>
          </div>

          <div className="px-4 pb-2 pt-4 sm:px-5">
            {chartLoading ? (
              <div className="flex h-[220px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : pieTotal === 0 && statusCounts.total === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No task status data yet.
              </div>
            ) : pieTotal === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
                <span className="font-display text-2xl font-semibold text-foreground">
                  {statusCounts.total}
                </span>
                <span>Total tasks (none pending / in progress / completed)</span>
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

        <CustomerCostBudgetCard customerId={customerId} />
      </section>
    </div>
  );
}
