import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/form";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  underlineTabListClass,
  underlineTabTriggerClass,
} from "@/components/ui/tabs";
import { BriefcaseBusiness, Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import {
  reportsService,
  type ApiTaskReportRow,
  type TaskReportGroupBy,
} from "@/lib/api/services/reports";
import {
  fetchCustomerOptions,
  fetchOperativeOptions,
  fetchProjectAssigneeOptions,
} from "@/lib/user-dropdowns";
import { downloadCsv } from "@/lib/week-ending";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports/jobs")({
  head: () => ({ meta: [{ title: "Job Report | Schore" }] }),
  component: JobReport,
});

const JOB_TABS: { value: TaskReportGroupBy; label: string }[] = [
  { value: "Client", label: "By Client" },
  { value: "Site", label: "By Site" },
  { value: "Project", label: "By Project" },
  { value: "Property", label: "By Property" },
];

const chartConfig = {
  amount: { label: "Amount", color: "var(--accent)" },
} satisfies ChartConfig;

const linkClass = "block max-w-[14rem] truncate font-medium text-info hover:underline";

function JobReport() {
  const [groupBy, setGroupBy] = useState<TaskReportGroupBy>("Client");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [operativeId, setOperativeId] = useState("");
  const [operativeLabel, setOperativeLabel] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [groupBy, fromDate, toDate, customerId, userId, operativeId]);

  const query = useQuery({
    queryKey: [
      "reports",
      "jobs",
      { groupBy, fromDate, toDate, customerId, userId, operativeId, page, pageSize },
    ],
    queryFn: async () =>
      (
        await reportsService.getTaskReport({
          groupBy,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          customerId: customerId || undefined,
          userId: userId || undefined,
          operativeId: operativeId || undefined,
          page,
          pageSize,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const chartData = useMemo(
    () =>
      (data?.chart ?? []).map((p) => ({
        label: p.label.length > 18 ? `${p.label.slice(0, 16)}…` : p.label,
        fullLabel: p.label,
        amount: p.amount,
        jobCount: p.jobCount,
      })),
    [data?.chart],
  );

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    downloadCsv(`job-report-${groupBy.toLowerCase()}.csv`, jobCsv(groupBy, rows));
    toast.success("Job report exported");
  };

  return (
    <div>
      <PageHeader
        title="Job Report"
        subtitle="One row per job — filters, totals and spend by group."
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
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
        <FilterSelect
          label="Client"
          value={customerId}
          selectedLabel={customerLabel}
          onClear={() => {
            setCustomerId("");
            setCustomerLabel(null);
          }}
          onSelect={(v, l) => {
            setCustomerId(v);
            setCustomerLabel(l);
          }}
          placeholder="All clients"
          queryKey={["users", "customers", "dropdown", "reports-jobs"]}
          fetchOptions={fetchCustomerOptions}
        />
        <FilterSelect
          label="User"
          value={userId}
          selectedLabel={userLabel}
          onClear={() => {
            setUserId("");
            setUserLabel(null);
          }}
          onSelect={(v, l) => {
            setUserId(v);
            setUserLabel(l);
          }}
          placeholder="All users"
          queryKey={["users", "assignees", "dropdown", "reports-jobs"]}
          fetchOptions={fetchProjectAssigneeOptions}
        />
        <FilterSelect
          label="Operative"
          value={operativeId}
          selectedLabel={operativeLabel}
          onClear={() => {
            setOperativeId("");
            setOperativeLabel(null);
          }}
          onSelect={(v, l) => {
            setOperativeId(v);
            setOperativeLabel(l);
          }}
          placeholder="All operatives"
          queryKey={["users", "operatives", "dropdown", "reports-jobs"]}
          fetchOptions={fetchOperativeOptions}
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jobs"
          value={String(data?.totalJobs ?? 0)}
          tip="Distinct jobs in this result set."
          icon={BriefcaseBusiness}
          tone="blue"
        />
        <StatCard
          label="Completed items"
          value={String(data?.totalCompleted ?? 0)}
          tip="Task items that are ticked or have a completed date."
          icon={Check}
          tone="green"
        />
        <StatCard
          label="Completion"
          value={`${data?.completionPercent ?? 0}%`}
          tip="Completed items ÷ total task items."
          icon={AnalyticsBarsIcon}
          tone="amber"
        />
        <StatCard
          label="Amount"
          value={fmtGBP(data?.totalAmount ?? 0)}
          tip="Sum of task-item amounts."
          icon={StackedCoinsIcon}
          tone="purple"
        />
      </div>

      {chartData.length > 0 ? (
        <section className="card-elevated mb-4 overflow-hidden">
          <div className="border-b px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">Amount by {groupBy.toLowerCase()}</h2>
            <p className="text-xs text-muted-foreground">Top groups for the current filters.</p>
          </div>
          <div className="px-2 pb-4 pt-2 sm:px-4">
            <ChartContainer config={chartConfig} className="h-[220px] w-full aspect-auto">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                      labelFormatter={(_, payload) =>
                        String(payload?.[0]?.payload?.fullLabel ?? "")
                      }
                      formatter={(value) => fmtGBP(Number(value))}
                    />
                  }
                />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </section>
      ) : null}

      <div className="card-elevated overflow-hidden">
        <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as TaskReportGroupBy)}>
          <div className="border-b px-3 pt-1 sm:px-4">
            <TabsList className={underlineTabListClass}>
              {JOB_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className={underlineTabTriggerClass}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {JOB_TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-0 focus-visible:outline-none">
              <JobReportTable
                groupBy={t.value}
                rows={rows}
                totalJobs={data?.totalCount ?? 0}
                totalQuantity={data?.totalQuantity ?? 0}
                totalCompleted={data?.totalCompleted ?? 0}
                totalAmount={data?.totalAmount ?? 0}
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
                  itemLabel="jobs"
                  disabled={query.isFetching}
                  controlsAlign="center"
                />
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  selectedLabel,
  onClear,
  onSelect,
  placeholder,
  queryKey,
  fetchOptions,
}: {
  label: string;
  value: string;
  selectedLabel: string | null;
  onClear: () => void;
  onSelect: (value: string, label: string | null) => void;
  placeholder: string;
  queryKey: readonly unknown[];
  fetchOptions: (search: string) => Promise<{ value: string; label: string }[]>;
}) {
  return (
    <div className="min-w-[11rem]">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <SearchableSelect
        className="mt-1 w-full min-w-[10rem] sm:w-44"
        value={value}
        onValueChange={(v) => {
          if (!v) onClear();
        }}
        onSelect={(option) => onSelect(option.value, option.value ? option.label : null)}
        placeholder={placeholder}
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
        aria-label={`Filter by ${label.toLowerCase()}`}
        queryKey={queryKey}
        fetchOptions={fetchOptions}
        selectedLabel={selectedLabel}
        emptyOption={{ value: "", label: placeholder }}
        triggerClassName="h-9 [&>span]:whitespace-nowrap"
      />
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

function AnalyticsBarsIcon({
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
      <path d="M4 19h16" />
      <path d="M8 19V11" />
      <path d="M12 19V5" />
      <path d="M16 19V13" />
    </svg>
  );
}

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
        </div>
      </div>
    </AppTooltip>
  );
}

function JobReportTable({
  groupBy,
  rows,
  totalJobs,
  totalQuantity,
  totalCompleted,
  totalAmount,
  loading,
}: {
  groupBy: TaskReportGroupBy;
  rows: ApiTaskReportRow[];
  totalJobs: number;
  totalQuantity: number;
  totalCompleted: number;
  totalAmount: number;
  loading: boolean;
}) {
  const contextCols = contextColumns(groupBy);

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
        No jobs for these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            {contextCols.map((c) => (
              <th key={c.key} className="px-4 py-2.5 font-medium">
                {c.label}
              </th>
            ))}
            <th className="px-4 py-2.5 font-medium">Number</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">
              <AppTooltip content="Sum of task-item quantities">Task</AppTooltip>
            </th>
            <th className="px-4 py-2.5 text-right font-medium">
              <AppTooltip content="Ticked / completed task items">Completed</AppTooltip>
            </th>
            <th className="px-4 py-2.5 text-right font-medium">
              <AppTooltip content="Working days elapsed / planned">Days</AppTooltip>
            </th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.jobId} className="hover:bg-muted/20">
              {contextCols.map((c) => (
                <td key={c.key} className="px-4 py-2.5">
                  {c.cell(row)}
                </td>
              ))}
              <td className="px-4 py-2.5 font-medium tabular-nums">
                <AppTooltip content={`Open job ${row.taskNumber}`} asChild>
                  <Link
                    to="/tasks/$id"
                    params={{ id: String(row.jobId) }}
                    search={{ mode: "view" }}
                    className="text-info hover:underline"
                  >
                    {row.taskNumber}
                  </Link>
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5">
                <AppTooltip content={row.jobTypeName} asChild align="start">
                  <span className="block max-w-[10rem] truncate">{row.jobTypeName}</span>
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5">
                <AppTooltip content={row.statusName || row.statusCode || "Status"} asChild>
                  <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    {row.statusName || row.statusCode || "—"}
                  </span>
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatQty(row.quantity)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <AppTooltip content={`${row.completedCount} of ${row.itemCount} items`}>
                  {row.completedCount}
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5 text-right">
                <AppTooltip
                  content={
                    row.daysPlanned > 0
                      ? `${row.daysElapsed} working days elapsed of ${row.daysPlanned} planned`
                      : `${row.daysElapsed} working days elapsed (no planned duration)`
                  }
                  asChild
                >
                  <span
                    className={cn(
                      "tabular-nums",
                      row.daysPlanned > 0 && row.daysElapsed > row.daysPlanned
                        ? "font-medium text-destructive"
                        : "",
                    )}
                  >
                    {formatDays(row.daysElapsed, row.daysPlanned)}
                  </span>
                </AppTooltip>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmtGBP(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/20 font-medium">
            <td className="px-4 py-2.5" colSpan={contextCols.length + 3}>
              Total ({totalJobs} jobs)
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatQty(totalQuantity)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{totalCompleted}</td>
            <td className="px-4 py-2.5" />
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtGBP(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EntityLink({
  to,
  id,
  label,
}: {
  to: "/customers/$id" | "/sites/$id" | "/projects/$id" | "/properties/$id";
  id: string;
  label: string | null | undefined;
}) {
  const text = label?.trim() || "—";
  if (text === "—" || !id) return <span>—</span>;
  return (
    <AppTooltip content={text} asChild align="start">
      <Link to={to} params={{ id: String(id) }} className={linkClass}>
        {text}
      </Link>
    </AppTooltip>
  );
}

function contextColumns(groupBy: TaskReportGroupBy): {
  key: string;
  label: string;
  text: (row: ApiTaskReportRow) => string;
  cell: (row: ApiTaskReportRow) => ReactNode;
}[] {
  switch (groupBy) {
    case "Site":
      return [
        {
          key: "site",
          label: "Site",
          text: (r) => r.siteName ?? "—",
          cell: (r) => <EntityLink to="/sites/$id" id={r.siteId} label={r.siteName} />,
        },
        {
          key: "client",
          label: "Client",
          text: (r) => r.customerName ?? "—",
          cell: (r) => <EntityLink to="/customers/$id" id={r.customerId} label={r.customerName} />,
        },
      ];
    case "Project":
      return [
        {
          key: "project",
          label: "Project",
          text: (r) => r.projectName ?? "—",
          cell: (r) => <EntityLink to="/projects/$id" id={r.projectId} label={r.projectName} />,
        },
        {
          key: "site",
          label: "Site",
          text: (r) => r.siteName ?? "—",
          cell: (r) => <EntityLink to="/sites/$id" id={r.siteId} label={r.siteName} />,
        },
        {
          key: "client",
          label: "Client",
          text: (r) => r.customerName ?? "—",
          cell: (r) => <EntityLink to="/customers/$id" id={r.customerId} label={r.customerName} />,
        },
      ];
    case "Property":
      return [
        {
          key: "property",
          label: "Property",
          text: (r) => r.propertyName ?? "—",
          cell: (r) => (
            <EntityLink to="/properties/$id" id={r.propertyId} label={r.propertyName} />
          ),
        },
        {
          key: "project",
          label: "Project",
          text: (r) => r.projectName ?? "—",
          cell: (r) => <EntityLink to="/projects/$id" id={r.projectId} label={r.projectName} />,
        },
        {
          key: "site",
          label: "Site",
          text: (r) => r.siteName ?? "—",
          cell: (r) => <EntityLink to="/sites/$id" id={r.siteId} label={r.siteName} />,
        },
        {
          key: "client",
          label: "Client",
          text: (r) => r.customerName ?? "—",
          cell: (r) => <EntityLink to="/customers/$id" id={r.customerId} label={r.customerName} />,
        },
      ];
    default:
      return [
        {
          key: "client",
          label: "Client",
          text: (r) => r.customerName ?? "—",
          cell: (r) => <EntityLink to="/customers/$id" id={r.customerId} label={r.customerName} />,
        },
        {
          key: "property",
          label: "Property",
          text: (r) => r.propertyName ?? "—",
          cell: (r) => (
            <EntityLink to="/properties/$id" id={r.propertyId} label={r.propertyName} />
          ),
        },
      ];
  }
}

function formatQty(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatDays(elapsed: number, planned: number) {
  if (planned > 0) return `${elapsed} / ${planned}`;
  return String(elapsed);
}

function jobCsv(groupBy: TaskReportGroupBy, rows: ApiTaskReportRow[]): string[][] {
  const cols = contextColumns(groupBy);
  return [
    [
      ...cols.map((c) => c.label),
      "Number",
      "Type",
      "Status",
      "Task",
      "Completed",
      "Days elapsed",
      "Days planned",
      "Amount",
    ],
    ...rows.map((r) => [
      ...cols.map((c) => c.text(r)),
      r.taskNumber,
      r.jobTypeName,
      r.statusName || r.statusCode,
      formatQty(r.quantity),
      String(r.completedCount),
      String(r.daysElapsed),
      String(r.daysPlanned),
      String(r.amount),
    ]),
  ];
}
