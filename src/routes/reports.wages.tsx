import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import {
  reportsService,
  type ApiWagesChartPoint,
  type ApiWagesReportRow,
} from "@/lib/api/services/reports";
import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import {
  downloadCsv,
  formatUkDate,
  formatWageWeekRange,
  invoiceNo,
} from "@/lib/week-ending";

export const Route = createFileRoute("/reports/wages")({
  head: () => ({ meta: [{ title: "Wages Report | Schore" }] }),
  component: WagesReport,
});

const linkClass = "font-medium text-info hover:underline";

const summaryChartConfig = {
  amount: { label: "Amount", color: "var(--accent)" },
} satisfies ChartConfig;

const moneyChartConfig = {
  gross: { label: "Gross", color: "var(--accent)" },
  cisDeduction: { label: "CIS", color: "var(--muted-foreground)" },
  net: { label: "Net", color: "var(--info)" },
} satisfies ChartConfig;

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

  const summaryChart = useMemo(
    () =>
      (data?.chartSummary ?? []).map((p) => ({
        label: p.label,
        fullLabel: p.label,
        amount: p.gross,
      })),
    [data?.chartSummary],
  );
  const byOperativeChart = useMemo(() => mapChartPoints(data?.chartByOperative), [data?.chartByOperative]);
  const byWeekChart = useMemo(() => mapChartPoints(data?.chartByWeek), [data?.chartByWeek]);
  const byStatusChart = useMemo(() => mapChartPoints(data?.chartByStatus), [data?.chartByStatus]);
  const byClientChart = useMemo(() => mapChartPoints(data?.chartByClient), [data?.chartByClient]);
  const byProjectChart = useMemo(() => mapChartPoints(data?.chartByProject), [data?.chartByProject]);
  const hasCharts =
    summaryChart.length > 0 ||
    byOperativeChart.length > 0 ||
    byWeekChart.length > 0 ||
    byStatusChart.length > 0 ||
    byClientChart.length > 0 ||
    byProjectChart.length > 0;

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
    <div>
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

      <div className="card-elevated mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <div className="min-w-[11rem]">
          <span className="text-[11px] font-medium text-muted-foreground">Client</span>
          <SearchableSelect
            className="mt-1 w-full min-w-[10rem] sm:w-44"
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
            triggerClassName="h-9 [&>span]:whitespace-nowrap"
          />
        </div>
        <div className="min-w-[9rem]">
          <span className="text-[11px] font-medium text-muted-foreground">Status</span>
          <SearchableSelect
            className="mt-1 w-full min-w-[9rem] sm:w-40"
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
            triggerClassName="h-9 [&>span]:whitespace-nowrap"
          />
        </div>
        <div className="min-w-[9rem]">
          <span className="text-[11px] font-medium text-muted-foreground">Payment</span>
          <SearchableSelect
            className="mt-1 w-full min-w-[9rem] sm:w-40"
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
            triggerClassName="h-9 [&>span]:whitespace-nowrap"
          />
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Statements" value={String(data?.statementCount ?? 0)} tip="Wage sheets matching filters." />
        <StatCard
          label="Gross"
          value={fmtGBP(data?.totalGross ?? 0)}
          tip="Total gross for days in range (partial weeks recalculated)."
        />
        <StatCard label="CIS" value={fmtGBP(data?.totalCisDeduction ?? 0)} tip="CIS on the ranged gross." />
        <StatCard label="Net" value={fmtGBP(data?.totalNet ?? 0)} tip="Total net for the date range." />
      </div>

      {statusCounts.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {statusCounts.map((s) => (
            <AppTooltip
              key={s.code || s.name}
              content={`${s.count} statement${s.count === 1 ? "" : "s"} with status ${s.name}`}
              asChild
            >
              <span className="inline-flex cursor-default items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium">
                <span className="text-muted-foreground">{s.name}</span>
                <span className="tabular-nums">{s.count}</span>
              </span>
            </AppTooltip>
          ))}
        </div>
      ) : null}

      {hasCharts ? (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <WagesChartCard
            title="Gross / CIS / Net"
            subtitle="Totals for the current filters."
            className="lg:col-span-2"
          >
            <SummaryBarChart data={summaryChart} />
          </WagesChartCard>
          <WagesChartCard title="By operative" subtitle="Top 12 by gross.">
            <MoneyBarChart data={byOperativeChart} grouped />
          </WagesChartCard>
          <WagesChartCard title="By week ending" subtitle="Trend across weeks in range.">
            <MoneyBarChart data={byWeekChart} />
          </WagesChartCard>
          <WagesChartCard title="By status" subtitle="Gross by sign-off status.">
            <MoneyBarChart data={byStatusChart} />
          </WagesChartCard>
          <WagesChartCard title="By client" subtitle="Top 12 by gross.">
            <MoneyBarChart data={byClientChart} grouped />
          </WagesChartCard>
          <WagesChartCard
            title="By project"
            subtitle="Top 12 by gross."
            className="lg:col-span-2"
          >
            <MoneyBarChart data={byProjectChart} grouped />
          </WagesChartCard>
        </div>
      ) : null}

      <div className="card-elevated overflow-hidden">
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

function StatCard({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <AppTooltip content={tip} asChild>
      <div className="card-elevated cursor-default px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      </div>
    </AppTooltip>
  );
}

function WagesChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-elevated overflow-hidden ${className ?? ""}`}>
      <div className="border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="px-2 pb-4 pt-2 sm:px-4">{children}</div>
    </section>
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
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function MoneyBarChart({ data, grouped = false }: { data: ChartRow[]; grouped?: boolean }) {
  if (data.length === 0) {
    return <ChartEmpty />;
  }

  return (
    <ChartContainer config={moneyChartConfig} className="h-[220px] w-full aspect-auto">
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
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                if (!row) return "";
                const count = row.count != null ? ` · ${row.count} sheet${row.count === 1 ? "" : "s"}` : "";
                return `${row.fullLabel}${count}`;
              }}
              formatter={(value) => fmtGBP(Number(value))}
            />
          }
        />
        <Bar dataKey="gross" fill="var(--color-gross)" radius={[4, 4, 0, 0]} />
        {grouped ? (
          <>
            <Bar dataKey="cisDeduction" fill="var(--color-cisDeduction)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="net" fill="var(--color-net)" radius={[4, 4, 0, 0]} />
          </>
        ) : null}
      </BarChart>
    </ChartContainer>
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      No chart data for these filters.
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
      <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading report…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-muted-foreground">
        No wage sheets for these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Invoice</th>
            <th className="px-4 py-2.5 font-medium">Operative</th>
            <th className="px-4 py-2.5 font-medium">Client</th>
            <th className="px-4 py-2.5 font-medium">Project</th>
            <th className="px-4 py-2.5 font-medium">Week</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Payment</th>
            <th className="px-4 py-2.5 text-right font-medium">Gross</th>
            <th className="px-4 py-2.5 text-right font-medium">
              <AppTooltip content="CIS deduction">CIS</AppTooltip>
            </th>
            <th className="px-4 py-2.5 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/20">
              <td className="px-4 py-2.5 tabular-nums">
                <AppTooltip content="Open wage sheet" asChild>
                  <Link
                    to="/wages/$id"
                    params={{ id: String(row.id) }}
                    search={{ weekEnding: row.weekEnding.slice(0, 10) }}
                    className={`${linkClass} font-mono text-xs`}
                  >
                    {invoiceNo(row.invoiceNumber)}
                  </Link>
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5">
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
              <td className="px-4 py-2.5">
                {row.customerNames ? (
                  <AppTooltip content={row.customerNames} asChild align="start">
                    <span className="block max-w-[12rem] truncate">{row.customerNames}</span>
                  </AppTooltip>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-2.5">
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
              <td className="px-4 py-2.5 tabular-nums">
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
              <td className="px-4 py-2.5">
                <AppTooltip content={row.statusName || row.statusCode} asChild>
                  <span>{row.statusName || "—"}</span>
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5">
                <AppTooltip content={row.paymentStatusName || row.paymentStatusCode} asChild>
                  <span>{row.paymentStatusName || "—"}</span>
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmtGBP(row.gross)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <AppTooltip content={`CIS rate ${row.cisRate}%`}>
                  {fmtGBP(row.cisDeduction)}
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmtGBP(row.net)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/20 font-medium">
            <td className="px-4 py-2.5" colSpan={7}>
              Total ({statementCount})
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtGBP(totalGross)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtGBP(totalCis)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtGBP(totalNet)}</td>
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
      "Client",
      "Project",
      "Site",
      "Week ending",
      "Partial",
      "Status",
      "Payment",
      "Gross",
      "CIS",
      "Net",
    ],
    ...rows.map((r) => [
      invoiceNo(r.invoiceNumber),
      r.operativeName,
      r.tradeName ?? "",
      r.customerNames ?? "",
      r.projectName ?? "",
      r.siteName ?? "",
      formatUkDate(r.weekEnding),
      r.isPartial ? "Yes" : "No",
      r.statusName,
      r.paymentStatusName,
      String(r.gross),
      String(r.cisDeduction),
      String(r.net),
    ]),
  ];
}
