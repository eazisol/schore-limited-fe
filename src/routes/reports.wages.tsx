import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Cell, Label, Pie, PieChart } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "@/components/form";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BriefcaseBusiness,
  ChartNoAxesColumnIncreasing,
  ChartPie,
  Download,
  Loader2,
} from "lucide-react";
import { Calculator, Download, FileText, LayoutGrid, Loader2, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import {
  reportsService,
  type ApiWagesReportRow,
  type ApiWagesStatusCount,
} from "@/lib/api/services/reports";
import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import {
  downloadCsv,
  formatUkDate,
  formatWageWeekRange,
  invoiceNo,
} from "@/lib/week-ending";
import { cn } from "@/lib/utils";
import {
  STATUS_TONE_CLASSES,
  statusToneForLabel,
  type StatusTone,
} from "@/lib/status-colors";

export const Route = createFileRoute("/reports/wages")({
  head: () => ({ meta: [{ title: "Wages Report | Schore" }] }),
  component: WagesReport,
});

const linkClass = "font-medium text-info hover:underline";

const GROSS_COLOR = "#15998B";
const CIS_COLOR = "#3D8EDB";
const NET_COLOR = "#6550D8";
const GOLD_COLOR = "#F2A91B";
const WAGE_BAR_PALETTE = [GROSS_COLOR, CIS_COLOR, NET_COLOR, GOLD_COLOR] as const;

const summaryChartConfig = {
  amount: { label: "Amount", color: GROSS_COLOR },
} satisfies ChartConfig;

const moneyChartConfig = {
  gross: { label: "Gross", color: GROSS_COLOR },
  cisDeduction: { label: "CIS", color: CIS_COLOR },
  net: { label: "Net", color: NET_COLOR },
} satisfies ChartConfig;

function summaryBarFill(label: string, index: number) {
  const key = label.trim().toLowerCase();
  if (key.includes("cis")) return CIS_COLOR;
  if (key.includes("net")) return NET_COLOR;
  if (key.includes("gross")) return GROSS_COLOR;
  return [GROSS_COLOR, CIS_COLOR, NET_COLOR][index % 3];
}

function paletteFill(index: number) {
  return WAGE_BAR_PALETTE[index % WAGE_BAR_PALETTE.length];
}

function mapChartPoints(points: ApiWagesChartPoint[] | undefined) {
  return (points ?? []).map((p) => ({
    label: p.label.length > 14 ? `${p.label.slice(0, 12)}…` : p.label,
    fullLabel: p.label,
    gross: p.gross,
    cisDeduction: p.cisDeduction,
    net: p.net,
    count: p.count,
    amount: p.gross,
  }));
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

function WagesReport() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [statusId, setStatusId] = useState("");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [paymentStatusId, setPaymentStatusId] = useState("");
  const [paymentStatusLabel, setPaymentStatusLabel] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, customerId, statusId, paymentStatusId]);

  const fetchSignOffOptions = useCallback(async (term: string): Promise<SearchableSelectOption[]> => {
    const res = await statusesService.list({
      documentTypeCode: DOCUMENT_TYPE_CODE.STATEMENT,
      pageSize: 50,
    });
    const q = term.trim().toLowerCase();
    return (res.data.items ?? [])
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, []);

  const fetchPaymentOptions = useCallback(async (term: string): Promise<SearchableSelectOption[]> => {
    const res = await statusesService.list({
      documentTypeCode: DOCUMENT_TYPE_CODE.STATEMENT_PAYMENT,
      pageSize: 50,
    });
    const q = term.trim().toLowerCase();
    return (res.data.items ?? [])
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, []);

  const query = useQuery({
    queryKey: [
      "reports",
      "wages",
      { fromDate, toDate, customerId, statusId, paymentStatusId, page, pageSize },
    ],
    queryFn: async () =>
      (
        await reportsService.getWagesReport({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          customerId: customerId || undefined,
          statusId: statusId || undefined,
          paymentStatusId: paymentStatusId || undefined,
          page,
          pageSize,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const statusCounts = data?.statusCounts ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

  const exportCsv = () => {
    if (!data?.rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const stamp = [fromDate || "all", toDate || "all"].join("_");
    downloadCsv(`wages-report-${stamp}.csv`, wagesCsv(data.rows));
    toast.success("Wages report exported");
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Wages Report"
        subtitle="Wage sheets by date — partial weeks recalculate gross, CIS and net from days in range."
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data?.rows.length}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

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
                    <StatusLegendItem
                      key={s.key}
                      name={s.name}
                      value={s.value}
                      fill={s.fill}
                    />
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
            value={String(data?.statementCount ?? 0)}
            tip="Wage sheets matching filters."
            tone="accent"
            icon={FileText}
          />
          <SummaryStat
            label="Gross"
            value={fmtGBP(data?.totalGross ?? 0)}
            tip="Total gross for days in range (partial weeks recalculated)."
            tone="accent"
            icon={LayoutGrid}
          />
          <SummaryStat
            label="CIS"
            value={fmtGBP(data?.totalCisDeduction ?? 0)}
            tip="CIS on the ranged gross."
            tone="muted"
            icon={MinusCircle}
          />
          <SummaryStat
            label="Net"
            value={fmtGBP(data?.totalNet ?? 0)}
            tip="Total net for the date range."
            tone="info"
            icon={Calculator}
          />
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:gap-2.5 sm:px-4">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="h-8 rounded-md border border-input bg-background px-2.5 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            className="h-8 rounded-md border border-input bg-background px-2.5 text-sm"
          />
          <SearchableSelect
            className="w-full min-w-[9rem] sm:w-40"
            value={customerId}
            onValueChange={(value) => {
              if (!value) {
                setCustomerId("");
                setCustomerLabel(null);
              }
            }}
            onSelect={(option) => {
              setCustomerId(option.value);
              setCustomerLabel(option.value ? option.label : null);
            }}
            placeholder="All clients"
            searchPlaceholder="Search clients…"
            aria-label="Filter wages by client"
            queryKey={["users", "customers", "dropdown", "reports-wages"]}
            fetchOptions={fetchCustomerOptions}
            selectedLabel={customerLabel}
            emptyOption={{ value: "", label: "All clients" }}
            triggerClassName="h-8 [&>span]:whitespace-nowrap"
          />
          <SearchableSelect
            className="w-full min-w-[8rem] sm:w-36"
            value={statusId}
            onValueChange={(value) => {
              if (!value) {
                setStatusId("");
                setStatusLabel(null);
              }
            }}
            onSelect={(option) => {
              setStatusId(option.value);
              setStatusLabel(option.value ? option.label : null);
            }}
            placeholder="All sign-off"
            searchPlaceholder="Search sign-off…"
            aria-label="Filter by sign-off status"
            queryKey={["statuses", DOCUMENT_TYPE_CODE.STATEMENT, "reports-wages"]}
            fetchOptions={fetchSignOffOptions}
            selectedLabel={statusLabel}
            emptyOption={{ value: "", label: "All sign-off" }}
            triggerClassName="h-8 [&>span]:whitespace-nowrap"
          />
          <SearchableSelect
            className="w-full min-w-[8rem] sm:w-36"
            value={paymentStatusId}
            onValueChange={(value) => {
              if (!value) {
                setPaymentStatusId("");
                setPaymentStatusLabel(null);
              }
            }}
            onSelect={(option) => {
              setPaymentStatusId(option.value);
              setPaymentStatusLabel(option.value ? option.label : null);
            }}
            placeholder="All payment"
            searchPlaceholder="Search payment…"
            aria-label="Filter by payment status"
            queryKey={["statuses", DOCUMENT_TYPE_CODE.STATEMENT_PAYMENT, "reports-wages"]}
            fetchOptions={fetchPaymentOptions}
            selectedLabel={paymentStatusLabel}
            emptyOption={{ value: "", label: "All payment" }}
            triggerClassName="h-8 [&>span]:whitespace-nowrap"
          />
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Statements"
          value={String(data?.statementCount ?? 0)}
          tip="Wage sheets matching filters."
          icon={BriefcaseBusiness}
          tone="blue"
        />
        <StatCard
          label="Gross"
          value={fmtGBP(data?.totalGross ?? 0)}
          tip="Total gross for days in range (partial weeks recalculated)."
          icon={ChartNoAxesColumnIncreasing}
          tone="green"
        />
        <StatCard
          label="CIS"
          value={fmtGBP(data?.totalCisDeduction ?? 0)}
          tip="CIS on the ranged gross."
          icon={ChartPie}
          tone="amber"
        />
        <StatCard
          label="Net"
          value={fmtGBP(data?.totalNet ?? 0)}
          tip="Total net for the date range."
          icon={StackedCoinsIcon}
          tone="purple"
        />
      </div>

        <WagesReportTable
          rows={data?.rows ?? []}
          statementCount={data?.statementCount ?? 0}
          totalGross={data?.totalGross ?? 0}
          totalCis={data?.totalCisDeduction ?? 0}
          totalNet={data?.totalNet ?? 0}
          loading={query.isFetching}
        />
        {(data?.totalCount ?? 0) > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={data?.totalCount ?? 0}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            itemLabel="statements"
            disabled={query.isFetching}
            controlsAlign="center"
          />
        ) : null}
      </div>
    </div>
  );
}

const STAT_TONES = {
  blue: {
    background: "linear-gradient(135deg, #EEF7FE 0%, #F6FCFE 100%)",
    circle: "#D3ECFD",
    icon: "#3D9BCB",
  },
  green: {
    background: "linear-gradient(135deg, #EEFAF7 0%, #F1FBF8 100%)",
    circle: "#DCF3ED",
    icon: "#15998B",
  },
  amber: {
    background: "linear-gradient(135deg, #FFF9F2 0%, #FDF8F1 100%)",
    circle: "#FDF1E1",
    icon: "#BE9256",
  },
  purple: {
    background: "linear-gradient(135deg, #F2F2FE 0%, #F4F3FE 100%)",
    circle: "#E0DFFE",
    icon: "#7373F4",
  },
} as const;

type KpiIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  "aria-hidden"?: boolean;
}>;

function StackedCoinsIcon({
  className,
  strokeWidth = 2,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <rect x="8" y="11" width="12" height="8" rx="2.2" />
      <path d="M11 15h6" />
      <rect x="4" y="5" width="12" height="8" rx="2.2" />
      <path d="M7 9h6" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  tip,
  icon: Icon,
  tone,
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
  icon: KpiIcon;
  tone: keyof typeof STAT_TONES;
}) {
  const colors = STAT_TONES[tone];
  return (
    <AppTooltip content={tip} asChild>
      <div
        className="card-elevated flex cursor-default items-center justify-between gap-3 px-4 py-3"
        style={{ background: colors.background }}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        </div>
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.circle }}
        >
          <Icon className="size-4" strokeWidth={2} style={{ color: colors.icon }} aria-hidden />
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

type ChartRow = {
  label: string;
  fullLabel: string;
  amount?: number;
  gross?: number;
  cisDeduction?: number;
  net?: number;
  count?: number;
};

function SummaryBarChart({ data }: { data: ChartRow[] }) {
  if (data.length === 0) {
    return <ChartEmpty />;
  }

  return (
    <ChartContainer config={summaryChartConfig} className="h-[220px] w-full aspect-auto">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={48}
          tickFormatter={(v) => `£${Number(v).toLocaleString("en-GB")}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => String(payload?.[0]?.payload?.fullLabel ?? "")}
              formatter={(value) => fmtGBP(Number(value))}
            />
          }
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]}>
          {data.map((row, index) => (
            <Cell key={`${row.fullLabel}-${index}`} fill={summaryBarFill(row.fullLabel, index)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
type PieSlice = { key: string; name: string; value: number; fill: string };

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
        <Bar dataKey="gross" fill="var(--color-gross)" radius={[4, 4, 0, 0]}>
          {data.map((row, index) => (
            <Cell key={`${row.fullLabel}-gross-${index}`} fill={paletteFill(index)} />
          ))}
        </Bar>
        {grouped ? (
          <>
            <Bar dataKey="cisDeduction" fill="var(--color-cisDeduction)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="net" fill="var(--color-net)" radius={[4, 4, 0, 0]} />
          </>
        ) : null}
      </BarChart>
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

function WagesReportTable({
  rows,
  statementCount,
  totalGross,
  totalCis,
  totalNet,
  loading,
}: {
  rows: ApiWagesReportRow[];
  statementCount: number;
  totalGross: number;
  totalCis: number;
  totalNet: number;
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading report…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No wage sheets for these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium sm:px-4">Invoice</th>
            <th className="px-3 py-2 font-medium">Operative</th>
            <th className="px-3 py-2 font-medium">Project</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Week</th>
            <th className="px-3 py-2 text-right font-medium">Gross</th>
            <th className="px-3 py-2 text-right font-medium">
              <AppTooltip content="CIS deduction">CIS</AppTooltip>
            </th>
            <th className="px-3 py-2 text-right font-medium">Net</th>
            <th className="px-3 py-2 font-medium">Payment</th>
            <th className="px-3 py-2 font-medium sm:px-4">Sign-off</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/20">
              <td className="px-3 py-1.5 tabular-nums sm:px-4">
                <AppTooltip content="Open wage sheet" asChild>
                  <Link
                    to="/wages/$id"
                    params={{ id: String(row.id) }}
                    search={{
                      from: "reports-wages" as const,
                      weekEnding: row.weekEnding.slice(0, 10),
                    }}
                    className={`${linkClass} font-mono text-xs`}
                  >
                    {invoiceNo(row.invoiceNumber)}
                  </Link>
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5">
                <AppTooltip content={row.operativeName} asChild align="start">
                  <Link
                    to="/operatives/$id"
                    params={{ id: String(row.operativeId) }}
                    className={`block max-w-[12rem] truncate ${linkClass}`}
                  >
                    {row.operativeName}
                  </Link>
                </AppTooltip>
                {row.tradeName ? (
                  <div className="text-xs text-muted-foreground">{row.tradeName}</div>
                ) : null}
              </td>
              <td className="px-3 py-1.5">
                {row.projectName ? (
                  <AppTooltip content={row.projectName} asChild align="start">
                    <Link
                      to="/projects/$id"
                      params={{ id: String(row.projectId) }}
                      className={`block max-w-[12rem] truncate ${linkClass}`}
                    >
                      {row.projectName}
                    </Link>
                  </AppTooltip>
                ) : (
                  "—"
                )}
                {row.siteName ? (
                  <div className="text-xs text-muted-foreground">{row.siteName}</div>
                ) : null}
              </td>
              <td className="px-3 py-1.5">
                {row.customerNames ? (
                  <AppTooltip content={row.customerNames} asChild align="start">
                    <span className="block max-w-[12rem] truncate">{row.customerNames}</span>
                  </AppTooltip>
                ) : (
                  "—"
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                <AppTooltip
                  content={
                    row.isPartial
                      ? `Partial week — amounts for days in filter only. Sheet week: ${formatWageWeekRange(row.weekStart, row.weekEnding)}`
                      : formatWageWeekRange(row.weekStart, row.weekEnding)
                  }
                >
                  <span>
                    {formatUkDate(row.weekEnding)}
                    {row.isPartial ? (
                      <span className="ml-1 text-[10px] font-medium uppercase text-muted-foreground">
                        partial
                      </span>
                    ) : null}
                  </span>
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtGBP(row.gross)}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                <AppTooltip content={`CIS rate ${row.cisRate}%`}>
                  {fmtGBP(row.cisDeduction)}
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums">
                {fmtGBP(row.net)}
              </td>
              <td className="px-3 py-1.5">
                <AppTooltip content={row.paymentStatusName || row.paymentStatusCode} asChild>
                  <span>{row.paymentStatusName || "—"}</span>
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5 sm:px-4">
                <AppTooltip content={row.statusName || row.statusCode} asChild>
                  <span>{row.statusName || "—"}</span>
                </AppTooltip>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/20 font-medium">
            <td className="px-3 py-2 sm:px-4" colSpan={5}>
              Total ({statementCount})
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(totalGross)}</td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(totalCis)}</td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(totalNet)}</td>
            <td className="px-3 py-2" colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function wagesCsv(rows: ApiWagesReportRow[]): string[][] {
  return [
    [
      "Invoice",
      "Operative",
      "Trade",
      "Project",
      "Site",
      "Client",
      "Week ending",
      "Partial",
      "Gross",
      "CIS",
      "Net",
      "Payment",
      "Sign-off",
    ],
    ...rows.map((r) => [
      invoiceNo(r.invoiceNumber),
      r.operativeName,
      r.tradeName ?? "",
      r.projectName ?? "",
      r.siteName ?? "",
      r.customerNames ?? "",
      formatUkDate(r.weekEnding),
      r.isPartial ? "Yes" : "No",
      String(r.gross),
      String(r.cisDeduction),
      String(r.net),
      r.paymentStatusName,
      r.statusName,
    ]),
  ];
}
