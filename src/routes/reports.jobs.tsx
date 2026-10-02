import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
  Tabs,
  TabsList,
  TabsTrigger,
  underlineTabListClass,
  underlineTabTriggerClass,
} from "@/components/ui/tabs";
import { BriefcaseBusiness, Check, Download, Loader2 } from "lucide-react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Loader2,
  PauseCircle,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import {
  reportsService,
  type ApiTaskReportRow,
  type ApiTaskReportStatusCount,
  type TaskReportGroupBy,
} from "@/lib/api/services/reports";
import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import {
  fetchCustomerOptions,
  fetchOperativeOptions,
  fetchProjectAssigneeOptions,
} from "@/lib/user-dropdowns";
import { downloadCsv } from "@/lib/week-ending";
import { cn } from "@/lib/utils";
import {
  STATUS_BADGE_BASE,
  STATUS_TONE_CLASSES,
  statusToneForLabel,
  type StatusTone,
} from "@/lib/status-colors";

export const Route = createFileRoute("/reports/jobs")({
  head: () => ({ meta: [{ title: "Job Report | Schore" }] }),
  component: JobReport,
});

const JOB_TABS: { value: TaskReportGroupBy; label: string }[] = [
  { value: "Client", label: "Client" },
  { value: "Site", label: "Site" },
  { value: "Project", label: "Project" },
  { value: "Property", label: "Property" },
];

const TONE_FILL: Record<StatusTone, string> = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  muted: "var(--muted-foreground)",
  accent: "var(--accent)",
};

const linkClass = "block max-w-[14rem] truncate font-medium text-info hover:underline";

function statusKey(s: ApiTaskReportStatusCount) {
  return (s.code || s.name).replace(/\s+/g, "_");
}

function statusIcon(name: string, code: string) {
  const key = (code || name).toUpperCase().replace(/\s+/g, "_");
  if (key.includes("PROGRESS")) return Loader2;
  if (key === "PENDING") return Clock;
  if (key.includes("HANDED")) return CheckCircle2;
  if (key === "HOLD" || key.includes("HOLD")) return PauseCircle;
  if (key === "DRAFT") return FileText;
  if (key === "COMPLETED") return CheckCircle2;
  if (key.includes("CANCEL")) return AlertCircle;
  return ClipboardList;
}

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
  const [statusId, setStatusId] = useState("");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [groupBy, fromDate, toDate, customerId, userId, operativeId, statusId]);

  const fetchStatusOptions = useCallback(async (term: string): Promise<SearchableSelectOption[]> => {
    const res = await statusesService.list({
      documentTypeCode: DOCUMENT_TYPE_CODE.TASK,
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
      "jobs",
      { groupBy, fromDate, toDate, customerId, userId, operativeId, statusId, page, pageSize },
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
          statusId: statusId || undefined,
          page,
          pageSize,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const rows = data?.rows ?? [];
  const statusCounts = data?.statusCounts ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  const statusTotal = useMemo(
    () => statusCounts.reduce((sum, s) => sum + s.count, 0),
    [statusCounts],
  );

  const statusBarData = useMemo(
    () =>
      statusCounts.map((s) => {
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

  const statusBarRows = useMemo(
    () => statusBarData.filter((d) => d.value > 0),
    [statusBarData],
  );

  const statusChartHeight = Math.max(64, statusBarRows.length * 26 + 20);

  const statusChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const s of statusCounts) {
      const key = statusKey(s);
      config[key] = {
        label: s.name,
        color: TONE_FILL[statusToneForLabel(s.name || s.code)],
      };
    }
    config.value = { label: "Jobs", color: "var(--accent)" };
    return config;
  }, [statusCounts]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    downloadCsv(`job-report-${groupBy.toLowerCase()}.csv`, jobCsv(groupBy, rows));
    toast.success("Job report exported");
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Job Report"
        subtitle="One row per job — filters, status totals and completion by group."
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
      <div className="card-elevated relative overflow-hidden">
        {query.isFetching ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/55 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : null}
        <div className="grid divide-y lg:grid-cols-[minmax(17rem,20rem)_7.5rem_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
          <div className="bg-muted/20 p-3 sm:p-3.5">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Summary
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SummaryTile
                label="Jobs"
                value={String(data?.totalJobs ?? 0)}
                tip="Distinct jobs in this result set."
                tone="accent"
                icon={Briefcase}
              />
              <SummaryTile
                label="Items"
                value={String(data?.totalItems ?? 0)}
                tip="Total task items across matching jobs."
                tone="info"
                icon={ClipboardList}
              />
              <SummaryTile
                label="Completed"
                value={String(data?.totalCompleted ?? 0)}
                tip="Task items that are ticked or have a completed date."
                tone="success"
                icon={CheckCircle2}
              />
              <CompletionSummaryTile
                percent={data?.completionPercent ?? 0}
                tip="Completed items ÷ total task items."
              />
              <SummaryTile
                label="Amount"
                value={fmtGBP(data?.totalAmount ?? 0)}
                tip="Sum of task-item amounts."
                tone="accent"
                icon={Wallet}
                className="col-span-2"
              />
            </div>
          </div>

          <div className="flex items-center justify-center self-stretch bg-muted/10 px-2 py-3">
            <ItemCompletionGauge
              completed={data?.totalCompleted ?? 0}
              percent={data?.completionPercent ?? 0}
              totalItems={data?.totalItems ?? 0}
            />
          </div>

          <div className="min-w-0 p-3 sm:p-3.5">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {statusTotal} job{statusTotal === 1 ? "" : "s"}
              </span>
            </div>

            {statusCounts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No status data</p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 w-full flex-1 rounded-md border bg-muted/15 p-2">
                  <ChartContainer
                    config={statusChartConfig}
                    className="w-full aspect-auto [&_.recharts-wrapper]:!h-auto"
                    style={{ height: statusChartHeight }}
                  >
                    <BarChart
                      data={statusBarRows}
                      layout="vertical"
                      margin={{ top: 4, right: 10, left: 0, bottom: 4 }}
                      barCategoryGap="18%"
                    >
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        tick={{ fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "var(--foreground)" }}
                        interval={0}
                      />
                      <ChartTooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                        content={<ChartTooltipContent hideLabel nameKey="name" />}
                      />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={20} isAnimationActive={false}>
                        {statusBarRows.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-[13rem] lg:w-[14rem]">
                  {statusCounts.map((s) => (
                    <StatusPill key={s.code || s.name} status={s} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b px-2 py-1.5 pr-3 sm:gap-3 sm:px-3 sm:pr-4">
          <Tabs
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as TaskReportGroupBy)}
            className="shrink-0"
          >
            <TabsList className={cn(underlineTabListClass, "min-w-0 w-auto gap-0 sm:gap-0.5")}>
              {JOB_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className={cn(
                    underlineTabTriggerClass,
                    "px-1.5 py-1 text-[11px] sm:px-2 sm:py-1.5 sm:text-xs",
                  )}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="ml-auto flex flex-nowrap items-center gap-1.5 pr-1 sm:gap-2 sm:pr-0">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="h-8 w-[8.5rem] shrink-0 rounded-md border border-input bg-background px-1.5 text-xs sm:w-[9.5rem] sm:px-2 sm:text-sm"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="h-8 w-[8.5rem] shrink-0 rounded-md border border-input bg-background px-1.5 text-xs sm:w-[9.5rem] sm:px-2 sm:text-sm"
            />
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
            <FilterSelect
              label="Status"
              value={statusId}
              selectedLabel={statusLabel}
              onClear={() => {
                setStatusId("");
                setStatusLabel(null);
              }}
              onSelect={(v, l) => {
                setStatusId(v);
                setStatusLabel(l);
              }}
              placeholder="All statuses"
              queryKey={["statuses", DOCUMENT_TYPE_CODE.TASK, "reports-jobs"]}
              fetchOptions={fetchStatusOptions}
              contentAlign="end"
            />
          </div>
        </div>

        <JobReportTable
          groupBy={groupBy}
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
  contentAlign = "start",
}: {
  label: string;
  value: string;
  selectedLabel: string | null;
  onClear: () => void;
  onSelect: (value: string, label: string | null) => void;
  placeholder: string;
  queryKey: readonly unknown[];
  fetchOptions: (search: string) => Promise<{ value: string; label: string }[]>;
  contentAlign?: "start" | "center" | "end";
}) {
  return (
    <SearchableSelect
      className="w-[7.5rem] shrink-0 sm:w-[8.5rem]"
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
      triggerClassName="h-8 text-xs sm:text-sm [&>span]:truncate"
      contentClassName="w-auto min-w-[14rem] max-w-[min(22rem,calc(100vw-2rem))]"
      truncateOptions={false}
      contentAlign={contentAlign}
    />
  );
}

function SummaryTile({
  label,
  value,
  tip,
  tone,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  tip: string;
  tone: StatusTone;
  icon: typeof Briefcase;
  className?: string;
}) {
  return (
    <AppTooltip content={tip} asChild>
      <div
        className={cn(
          "cursor-default rounded-md border px-2 py-1.5",
          STATUS_TONE_CLASSES[tone],
          className,
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-background/70">
            <Icon className="h-3 w-3" aria-hidden />
          </span>
          <div className="min-w-0 leading-none">
            <div className="truncate text-[10px] font-medium uppercase tracking-wide opacity-80">
              {label}
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
          </div>
        </div>
      </div>
    </AppTooltip>
  );
}

function MiniPercentRing({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const size = 28;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const mid = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90 shrink-0"
      aria-hidden
    >
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={stroke}
      />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ItemCompletionGauge({
  completed,
  percent,
  totalItems,
}: {
  completed: number;
  percent: number;
  totalItems: number;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const size = 108;
  const stroke = 8.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const mid = size / 2;
  const displayPct =
    Number.isInteger(clamped) || clamped >= 100 ? String(clamped) : clamped.toFixed(1);

  const tip =
    totalItems > 0
      ? `${completed} of ${totalItems} task items complete (${displayPct}%).`
      : "No task items in this result set.";

  return (
    <AppTooltip content={tip} asChild>
      <div className="cursor-default">
        <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={mid}
              cy={mid}
              r={r}
              fill="none"
              stroke="var(--warning)"
              strokeOpacity={0.35}
              strokeWidth={stroke}
            />
            <circle
              cx={mid}
              cy={mid}
              r={r}
              fill="none"
              stroke="var(--success)"
              strokeWidth={stroke}
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-xl font-bold tabular-nums">{completed}</span>
            <span className="mt-1 text-xs font-semibold tabular-nums text-success">
              {displayPct}%
            </span>
          </div>
        </div>
      </div>
    </AppTooltip>
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
function CompletionSummaryTile({ percent, tip }: { percent: number; tip: string }) {
  const display =
    Number.isInteger(percent) || percent >= 100 ? String(percent) : percent.toFixed(1);

  return (
    <AppTooltip content={tip} asChild>
      <div
        className={cn(
          "flex cursor-default items-center gap-1.5 rounded-md border px-2 py-1.5",
          STATUS_TONE_CLASSES.warning,
        )}
      >
        <span className="text-warning">
          <MiniPercentRing value={percent} />
        </span>
        <div className="min-w-0 flex-1 leading-none">
          <div className="truncate text-[10px] font-medium uppercase tracking-wide opacity-80">
            Completion
          </div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{display}%</div>
        </div>
      </div>
    </AppTooltip>
  );
}

function StatusPill({ status }: { status: ApiTaskReportStatusCount }) {
  const tone = statusToneForLabel(status.name || status.code);
  const isZero = status.count === 0;
  const Icon = statusIcon(status.name, status.code);

  return (
    <AppTooltip
      content={`${status.count} job${status.count === 1 ? "" : "s"} with status ${status.name}`}
      asChild
    >
      <div
        className={cn(
          "flex cursor-default items-center gap-1.5 rounded-md border px-2 py-1",
          STATUS_TONE_CLASSES[tone],
          isZero && "opacity-45",
        )}
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-background/70">
          <Icon className="h-3 w-3" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide">
          {status.name}
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums">{status.count}</span>
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
      <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading report…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No jobs for these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            {contextCols.map((c, i) => (
              <th
                key={c.key}
                className={cn("px-3 py-2 font-medium", i === 0 && "sm:px-4")}
              >
                {c.label}
              </th>
            ))}
            <th className="px-3 py-2 font-medium">Number</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">
              <AppTooltip content="Sum of task-item quantities">Task</AppTooltip>
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <AppTooltip content="Ticked / completed task items">Completed</AppTooltip>
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              <AppTooltip content="Working days elapsed / planned">Days</AppTooltip>
            </th>
            <th className="px-3 py-2 text-right font-medium sm:px-4">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.jobId} className="hover:bg-muted/20">
              {contextCols.map((c, i) => (
                <td key={c.key} className={cn("px-3 py-1.5", i === 0 && "sm:px-4")}>
                  {c.cell(row)}
                </td>
              ))}
              <td className="px-3 py-1.5 font-medium tabular-nums">
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
              <td className="px-3 py-1.5">
                <AppTooltip content={row.jobTypeName} asChild align="start">
                  <span className="block max-w-[10rem] truncate">{row.jobTypeName}</span>
                </AppTooltip>
              </td>
              <td className="whitespace-nowrap px-3 py-1.5">
                <AppTooltip content={row.statusName || row.statusCode || "Status"} asChild>
                  <span className="inline-flex whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {row.statusName || row.statusCode || "—"}
                  </span>
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatQty(row.quantity)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                <AppTooltip content={`${row.completedCount} of ${row.itemCount} items`}>
                  {row.completedCount}
                </AppTooltip>
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right">
                <AppTooltip
                  content={
                    row.daysPlanned > 0
                      ? `${row.daysElapsed} working days elapsed of ${row.daysPlanned} planned`
                      : `${row.daysElapsed} working days elapsed (no planned duration)`
                  }
                  asChild
                >
                  <span className={cn(STATUS_BADGE_BASE, daysToneClass(row.daysElapsed, row.daysPlanned))}>
                    {formatDays(row.daysElapsed, row.daysPlanned)}
                  </span>
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums sm:px-4">
                {fmtGBP(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/20 font-medium">
            <td className="px-3 py-2 sm:px-4" colSpan={contextCols.length + 3}>
              Total ({totalJobs} jobs)
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{formatQty(totalQuantity)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{totalCompleted}</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right font-mono tabular-nums sm:px-4">
              {fmtGBP(totalAmount)}
            </td>
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

function daysToneClass(elapsed: number, planned: number) {
  if (planned > 0 && elapsed > planned) return STATUS_TONE_CLASSES.destructive;
  if (planned > 0 && elapsed === planned) return STATUS_TONE_CLASSES.warning;
  if (planned > 0) return STATUS_TONE_CLASSES.success;
  return STATUS_TONE_CLASSES.info;
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
