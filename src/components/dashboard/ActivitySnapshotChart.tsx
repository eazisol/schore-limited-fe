import { CartesianGrid, Label, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ActivityPoint } from "@/lib/dashboard-activity";

const chartConfig = {
  active: { label: "Active properties", color: "var(--info)" },
} satisfies ChartConfig;

function SeriesLabel({
  x,
  y,
  index,
  targetIndex,
  text,
  fill,
  anchor = "middle",
  dx = 0,
  dy = -10,
}: {
  x?: number | string;
  y?: number | string;
  index?: number;
  targetIndex: number;
  text: string;
  fill: string;
  anchor?: "start" | "middle" | "end";
  dx?: number;
  dy?: number;
}) {
  if (index !== targetIndex || x == null || y == null) return null;
  return (
    <text
      x={Number(x) + dx}
      y={Number(y) + dy}
      textAnchor={anchor}
      fill={fill}
      className="text-[11px] font-semibold"
    >
      {text}
    </text>
  );
}

export function ActivitySnapshotChart({
  data,
  subtitle,
}: {
  data: ActivityPoint[];
  subtitle: string;
}) {
  const isSingle = data.length === 1;
  const lastIndex = Math.max(data.length - 1, 0);
  const activeValue = data[0]?.active ?? 0;
  const yMax = Math.max(4, activeValue);

  return (
    <section className="card-elevated overflow-hidden">
      <div className="px-4 pt-4 sm:px-5">
        <h2 className="font-display text-base font-semibold">Activity Snapshot</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="px-2 pb-4 pt-1 sm:px-4">
        {data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No property activity for this period.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
            <LineChart
              accessibilityLayer
              data={data}
              margin={{ top: 28, right: isSingle ? 96 : 88, left: 4, bottom: 4 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tick={{ fontSize: 11 }}
                interval={0}
                minTickGap={4}
                padding={{ left: 12, right: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                domain={[0, yMax]}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) => {
                  if (value === 0) return "";
                  return value >= 1000 ? `${value / 1000}k` : String(value);
                }}
              >
                <Label
                  value="Properties"
                  angle={-90}
                  position="insideLeft"
                  offset={8}
                  style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
              </YAxis>
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Line
                type="monotone"
                dataKey="active"
                name="Active properties"
                stroke="var(--color-active)"
                strokeWidth={2.5}
                dot={{
                  r: isSingle ? 5 : 3,
                  fill: "var(--color-active)",
                  stroke: "var(--color-card)",
                  strokeWidth: 2,
                }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-card)" }}
                isAnimationActive={false}
                label={(props) => (
                  <SeriesLabel
                    {...props}
                    targetIndex={lastIndex}
                    text={isSingle ? `Active properties ${activeValue}` : "Active properties"}
                    fill="var(--info)"
                    anchor="start"
                    dx={10}
                    dy={-4}
                  />
                )}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}
