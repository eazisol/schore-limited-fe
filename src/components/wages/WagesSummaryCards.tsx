import { useMemo } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";
import { AppTooltip } from "@/components/AppTooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Calculator, FileText, LayoutGrid, MinusCircle } from "lucide-react";
import { fmtGBP } from "@/lib/data";
import type { ApiWagesStatusCount } from "@/lib/api/services/reports";
import { cn } from "@/lib/utils";
import {
  STATUS_TONE_CLASSES,
  statusToneForLabel,
  type StatusTone,
} from "@/lib/status-colors";

const TONE_FILL: Record<StatusTone, string> = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  muted: "var(--muted-foreground)",
  accent: "var(--accent)",
};

function statusKey(s: ApiWagesStatusCount) {
  return (s.code || s.name).replace(/\s+/g, "_");
}

type PieSlice = { key: string; name: string; value: number; fill: string };

export function WagesSummaryCards({
  statementCount,
  totalGross,
  totalCisDeduction,
  totalNet,
  statusCounts,
  statementsTip = "Wage sheets matching filters.",
  grossTip = "Total gross for matching wage sheets.",
  cisTip = "Total CIS deduction for matching wage sheets.",
  netTip = "Total net for matching wage sheets.",
}: {
  statementCount: number;
  totalGross: number;
  totalCisDeduction: number;
  totalNet: number;
  statusCounts: ApiWagesStatusCount[];
  statementsTip?: string;
  grossTip?: string;
  cisTip?: string;
  netTip?: string;
}) {
  const statusTotal = useMemo(
    () => statusCounts.reduce((sum, s) => sum + s.count, 0),
    [statusCounts],
  );

  const statusPieData = useMemo(
    () =>
      statusCounts
        .filter((s) => s.count > 0)
        .map((s) => {
          const key = statusKey(s);
          return {
            key,
            name: s.name,
            value: s.count,
            fill: TONE_FILL[statusToneForLabel(s.name || s.code)],
          };
        }),
    [statusCounts],
  );

  const statusChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const s of statusCounts) {
      const key = statusKey(s);
      config[key] = {
        label: s.name,
        color: TONE_FILL[statusToneForLabel(s.name || s.code)],
      };
    }
    return config;
  }, [statusCounts]);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="grid divide-y sm:grid-cols-2 lg:grid-cols-[minmax(17rem,22rem)_repeat(4,minmax(0,1fr))] lg:divide-x lg:divide-y-0">
        <div className="flex items-center gap-3 px-3 py-2 sm:col-span-2 sm:px-3.5 lg:col-span-1">
          <SignOffPieChart data={statusPieData} total={statusTotal} config={statusChartConfig} />
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                By sign-off
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {statusTotal} sheet{statusTotal === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {statusPieData.length > 0 ? (
                statusPieData.map((s) => (
                  <StatusLegendItem key={s.key} name={s.name} value={s.value} fill={s.fill} />
                ))
              ) : statusCounts.length > 0 ? (
                statusCounts.map((s) => (
                  <StatusLegendItem
                    key={s.code || s.name}
                    name={s.name}
                    value={s.count}
                    fill={TONE_FILL[statusToneForLabel(s.name || s.code)]}
                  />
                ))
              ) : (
                <p className="py-1 text-center text-xs text-muted-foreground">No status data</p>
              )}
            </div>
          </div>
        </div>

        <SummaryStat
          label="Statements"
          value={String(statementCount)}
          tip={statementsTip}
          tone="accent"
          icon={FileText}
        />
        <SummaryStat
          label="Gross"
          value={fmtGBP(totalGross)}
          tip={grossTip}
          tone="accent"
          icon={LayoutGrid}
        />
        <SummaryStat
          label="CIS"
          value={fmtGBP(totalCisDeduction)}
          tip={cisTip}
          tone="muted"
          icon={MinusCircle}
        />
        <SummaryStat
          label="Net"
          value={fmtGBP(totalNet)}
          tip={netTip}
          tone="info"
          icon={Calculator}
        />
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tip,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tip: string;
  tone: StatusTone;
  icon: typeof FileText;
}) {
  return (
    <AppTooltip content={tip} asChild>
      <div className="flex cursor-default items-center gap-2 px-3 py-2 sm:px-3.5">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-md border",
            STATUS_TONE_CLASSES[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 leading-none">
          <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-0.5 text-base font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </div>
        </div>
      </div>
    </AppTooltip>
  );
}

function StatusLegendItem({
  name,
  value,
  fill,
}: {
  name: string;
  value: number;
  fill: string;
}) {
  return (
    <AppTooltip
      content={`${value} statement${value === 1 ? "" : "s"} with status ${name}`}
      asChild
    >
      <div className="flex cursor-default items-center gap-1.5 text-[11px]">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: fill }}
          aria-hidden
        />
        <span className="truncate text-muted-foreground">{name}</span>
        <span className="shrink-0 font-semibold tabular-nums text-foreground">{value}</span>
      </div>
    </AppTooltip>
  );
}

function SignOffPieChart({
  data,
  total,
  config,
}: {
  data: PieSlice[];
  total: number;
  config: ChartConfig;
}) {
  if (data.length === 0 || total === 0) {
    return <ChartEmpty />;
  }

  return (
    <ChartContainer
      config={config}
      className="aspect-square h-[88px] w-[88px] shrink-0 overflow-visible sm:h-[100px] sm:w-[100px]"
    >
      <PieChart margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel nameKey="key" />}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="key"
          innerRadius="54%"
          outerRadius="88%"
          strokeWidth={2}
          stroke="var(--color-card)"
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((entry) => (
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
                      y={(viewBox.cy ?? 0) - 4}
                      className="fill-foreground font-display text-base font-semibold sm:text-lg"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 10}
                      className="fill-muted-foreground text-[9px]"
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
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-[88px] w-[88px] items-center justify-center text-xs text-muted-foreground sm:h-[100px] sm:w-[100px]">
      —
    </div>
  );
}
