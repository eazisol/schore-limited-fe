import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Label, Pie, PieChart } from "recharts";
import { Award, CheckCircle2, ChevronDown, ClipboardList, Clock, Database, Eye, FileText, HeartPulse, IdCard, Loader2, Paperclip, Percent, Plus, PoundSterling, Shield } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/CodeBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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
import { usePermission } from "@/components/Permission";
import { resolveProfileImageUrl, type ApiUser } from "@/lib/api/services/users";
import { tasksService } from "@/lib/api/services/tasks";
import { formatDailyRate } from "@/lib/module-ui";
import { formatUkDate } from "@/lib/week-ending";
import { formatSortCodeInput } from "@/lib/user-form";
import { IN_PROGRESS_STATUS_CODE } from "@/lib/hold";
import { isNonEmptyId } from "@/lib/ids";
import {
  certificationStatusFromExpiry,
  formatCertificationDisplayDate,
  formatCertificationExpiryRelative,
} from "@/lib/operative-certifications";
import { TASKS_ROUTE } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const PENDING_STATUS_CODE = "PENDING";
const COMPLETED_STATUS_CODE = "COMPLETED";

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
  return <p className="px-1 py-8 text-center text-sm text-muted-foreground">{message}</p>;
}

function formatShortDate(value: string | null | undefined) {
  return formatUkDate(value);
}

function formatDisplayDate(value: string | null | undefined) {
  return formatCertificationDisplayDate(value);
}

const CERT_ICON_STYLES = [
  { Icon: Award, className: "bg-success/15 text-success" },
  { Icon: IdCard, className: "bg-info/15 text-info" },
  { Icon: HeartPulse, className: "bg-warning/15 text-warning-foreground" },
  { Icon: Shield, className: "bg-accent/15 text-accent" },
] as const;

function certificationIconStyle(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash + key.charCodeAt(i) * (i + 1)) % CERT_ICON_STYLES.length;
  return CERT_ICON_STYLES[hash] ?? CERT_ICON_STYLES[0];
}

function RatesSummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-[10.5rem] flex-1 items-center gap-3 rounded-lg border border-border bg-background px-3 py-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value || "—"}</p>
      </div>
    </div>
  );
}

function OperativeRatesPanel({
  dailyRate,
  cisName,
  isDailyRate,
  rateOverrides,
}: {
  dailyRate: string;
  cisName: string;
  isDailyRate: boolean;
  rateOverrides: NonNullable<ApiUser["rateOverrides"]>;
}) {
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [overridesOpen, setOverridesOpen] = useState(true);
  const overrideCount = rateOverrides.length;

  return (
    <div className="space-y-4">
      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent/10 text-accent">
            <Database className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 text-left"
              >
                <div>
                  <h3 className="font-display text-base font-semibold">Rates</h3>
                  <p className="text-xs text-muted-foreground">
                    Manage daily rate, CIS status and product-specific overrides for this operative.
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    summaryOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="mt-3">
          <div className="flex flex-wrap gap-2">
            <RatesSummaryCard
              icon={<PoundSterling className="h-4 w-4" aria-hidden />}
              label="Daily rate"
              value={dailyRate}
            />
            <RatesSummaryCard
              icon={<Percent className="h-4 w-4" aria-hidden />}
              label="CIS"
              value={cisName}
            />
            {isDailyRate ? (
              <RatesSummaryCard
                icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                label="Daily rate pay"
                value="Enabled"
              />
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={overridesOpen} onOpenChange={setOverridesOpen}>
        <div className="rounded-lg border border-border">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-2 px-3 py-3 text-left sm:px-4"
            >
              <div>
                <h4 className="text-sm font-semibold">
                  Rate overrides{overrideCount > 0 ? ` (${overrideCount})` : ""}
                </h4>
                <p className="text-xs text-muted-foreground">
                  These product/item rates override the catalogue rate when applicable.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  overridesOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            {overrideCount === 0 ? (
              <p className="border-t px-3 py-6 text-center text-sm text-muted-foreground sm:px-4">
                No agreed rate overrides. Catalogue rates apply.
              </p>
            ) : (
              <div className="overflow-x-auto border-t">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium sm:px-4">Item / Product</th>
                      <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                      <th className="px-3 py-2.5 text-left font-medium sm:px-4">Effective from</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rateOverrides.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 font-medium sm:px-4">
                          {row.productName || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                          {formatDailyRate(row.rate)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground sm:px-4">
                          {formatDisplayDate(row.effectiveFrom)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

function itemStatusLabel(
  statusName: string | null | undefined,
  statusCode: string | null | undefined,
) {
  const code = (statusCode ?? "").toUpperCase();
  if (!code || code === "DRAFT") return "Pending";
  return statusName || statusCode || "Pending";
}

async function countOperativeItems(operativeId: string, statusCode?: string) {
  const data = (
    await tasksService.listItems({
      page: 1,
      pageSize: 1,
      operativeId,
      ...(statusCode ? { statusCode } : {}),
    })
  ).data;
  return data.totalCount;
}

export function OperativeDetailExtras({
  user,
  canEdit,
  onEdit,
}: {
  user: ApiUser;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const operativeId = String(user.id);
  const navigate = useNavigate();
  const canAddTask = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const [tab, setTab] = useState("tasks");

  const itemsQuery = useQuery({
    queryKey: ["task-items", "operative", operativeId],
    queryFn: async () =>
      (
        await tasksService.listItems({
          page: 1,
          pageSize: 50,
          operativeId,
          sortBy: "workdate",
          sortDir: "desc",
        })
      ).data,
    enabled: isNonEmptyId(operativeId),
  });

  const countsQuery = useQuery({
    queryKey: ["task-items", "operative-counts", operativeId],
    queryFn: async () => {
      const [total, pending, inProgress, completed] = await Promise.all([
        countOperativeItems(operativeId),
        countOperativeItems(operativeId, PENDING_STATUS_CODE),
        countOperativeItems(operativeId, IN_PROGRESS_STATUS_CODE),
        countOperativeItems(operativeId, COMPLETED_STATUS_CODE),
      ]);
      return { total, pending, inProgress, completed };
    },
    enabled: isNonEmptyId(operativeId),
  });

  const items = itemsQuery.data?.items ?? [];
  const statusCounts = countsQuery.data ?? {
    total: itemsQuery.data?.totalCount ?? 0,
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

  const pieTotal = statusCounts.pending + statusCounts.inProgress + statusCounts.completed;
  const chartLoading = countsQuery.isLoading;

  const tradeNames = useMemo(() => {
    if (user.tradeNames?.length) return user.tradeNames.filter(Boolean);
    if (user.tradeName?.trim()) {
      return user.tradeName
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
    }
    return [];
  }, [user.tradeName, user.tradeNames]);

  const certifications = user.certifications ?? [];
  const rateOverrides = user.rateOverrides ?? [];

  const addLabel =
    tab === "tasks"
      ? "Add task"
      : tab === "bank"
        ? "Edit payment details"
        : tab === "certificates"
          ? "Edit certificates"
          : tab === "trades"
            ? "Edit trades"
            : "Edit rates";

  const showAdd = tab === "tasks" ? canAddTask : Boolean(canEdit && onEdit);

  function handleAdd() {
    if (tab === "tasks") {
      navigate({ to: "/tasks/new" });
      return;
    }
    onEdit?.();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
      <section className="card-elevated min-w-0 overflow-hidden lg:col-span-8">
        <Tabs value={tab} onValueChange={setTab} className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 pt-1 sm:px-4">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <TabsList className={underlineTabListClass}>
                <TabsTrigger value="tasks" className={underlineTabTriggerClass}>
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="bank" className={underlineTabTriggerClass}>
                  Bank
                </TabsTrigger>
                <TabsTrigger value="certificates" className={underlineTabTriggerClass}>
                  Certificates
                </TabsTrigger>
                <TabsTrigger value="trades" className={underlineTabTriggerClass}>
                  Trades
                </TabsTrigger>
                <TabsTrigger value="rates" className={underlineTabTriggerClass}>
                  Rates
                </TabsTrigger>
              </TabsList>
            </div>
            {showAdd ? (
              <Button size="sm" className="mb-1 shrink-0" onClick={handleAdd}>
                <Plus className="h-4 w-4" />
                {addLabel}
              </Button>
            ) : null}
          </div>

          <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
            {itemsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading task items…
              </div>
            ) : itemsQuery.isError ? (
              <EmptyPanel message="Unable to load task items for this operative." />
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No task items assigned to this operative.
                </p>
                {canAddTask ? (
                  <Button size="sm" onClick={() => navigate({ to: "/tasks/new" })}>
                    <Plus className="h-4 w-4" />
                    Add task
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Job</th>
                      <th className="px-3 py-2.5 text-left font-medium">Task</th>
                      <th className="px-3 py-2.5 text-left font-medium">Property</th>
                      <th className="px-3 py-2.5 text-left font-medium">Work date</th>
                      <th className="px-3 py-2.5 text-left font-medium">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums">
                          {item.taskNumber}
                        </td>
                        <td className="max-w-[12rem] px-3 py-2.5">
                          <div className="truncate font-medium">
                            {item.productName || item.tradeGroupName || "—"}
                          </div>
                          {item.tradeName ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {item.tradeName}
                            </div>
                          ) : null}
                        </td>
                        <td className="max-w-[12rem] truncate px-3 py-2.5 text-muted-foreground">
                          {item.propertyName}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                          {formatShortDate(item.workDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={itemStatusLabel(item.statusName, item.statusCode)} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                            <Link
                              to="/tasks/$id"
                              params={{ id: String(item.taskId) }}
                              search={{ mode: "view" }}
                              aria-label={`View ${item.taskNumber}`}
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
              <DetailRow
                label="Sort code"
                value={
                  user.sortCode?.trim() ? (
                    <CodeBadge code={formatSortCodeInput(user.sortCode)} />
                  ) : undefined
                }
              />
              <DetailRow
                label="Account number"
                value={
                  user.accountNumber?.trim() ? (
                    <CodeBadge code={user.accountNumber.replace(/\D/g, "")} />
                  ) : undefined
                }
              />
            </dl>
          </TabsContent>

          <TabsContent
            value="certificates"
            className="mt-0 px-3 py-3 focus-visible:outline-none sm:px-4"
          >
            {certifications.length === 0 ? (
              <EmptyPanel message="No certificates on file." />
            ) : (
              <div className="-mx-3 overflow-x-auto sm:-mx-4">
                <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 pb-2.5 pt-1 font-medium sm:px-4">Certificate</th>
                      <th className="px-3 pb-2.5 pt-1 font-medium">Level</th>
                      <th className="px-3 pb-2.5 pt-1 font-medium">Certificate no.</th>
                      <th className="px-3 pb-2.5 pt-1 font-medium">Issue date</th>
                      <th className="px-3 pb-2.5 pt-1 font-medium">Expiry date</th>
                      <th className="px-3 pb-2.5 pt-1 font-medium">Status</th>
                      <th className="px-3 pb-2.5 pt-1 font-medium sm:px-4">Attachments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certifications.map((cert) => {
                      const status = certificationStatusFromExpiry(cert.expiryDate);
                      const relative = formatCertificationExpiryRelative(cert.expiryDate);
                      const files = cert.files ?? [];
                      const typeName = cert.certificationTypeName?.trim() || "Certification";
                      const typeCode = cert.certificationTypeCode?.trim();
                      const levelName = cert.certificationLevelName?.trim() || "—";
                      const number = cert.documentNumber?.trim() || "—";
                      const { Icon, className: iconClass } = certificationIconStyle(
                        String(cert.certificationTypeId ?? typeName),
                      );
                      const fileCount = files.length;
                      const fileLabel =
                        fileCount === 0
                          ? "—"
                          : `${fileCount} file${fileCount === 1 ? "" : "s"}`;

                      return (
                        <tr
                          key={cert.id ?? `${cert.certificationTypeId}-${cert.startDate}`}
                          className="border-b border-border/70 last:border-b-0"
                        >
                          <td className="px-3 py-3.5 sm:px-4">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={cn(
                                  "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                                  iconClass,
                                )}
                              >
                                <Icon className="h-4 w-4" aria-hidden />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{typeName}</p>
                                {typeCode ? (
                                  <p className="truncate text-xs text-muted-foreground">{typeCode}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-foreground">{levelName}</td>
                          <td className="px-3 py-3.5 font-mono text-[13px] text-foreground">
                            {number}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-foreground">
                            {formatCertificationDisplayDate(cert.startDate)}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <p className="text-foreground">
                              {formatCertificationDisplayDate(cert.expiryDate)}
                            </p>
                            {relative ? (
                              <p
                                className={cn(
                                  "text-xs",
                                  relative.tone === "destructive" && "text-destructive",
                                  relative.tone === "warning" && "text-warning-foreground",
                                  relative.tone === "muted" && "text-muted-foreground",
                                )}
                              >
                                {relative.text}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3.5">
                            {status ? <StatusBadge status={status} /> : "—"}
                          </td>
                          <td className="px-3 py-3.5 sm:px-4">
                            {fileCount === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : fileCount === 1 ? (
                              <a
                                href={resolveProfileImageUrl(files[0]!.filePath)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {fileLabel}
                              </a>
                            ) : (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  >
                                    <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    {fileLabel}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-64 p-2">
                                  <ul className="space-y-1">
                                    {files.map((file) => (
                                      <li key={file.id}>
                                        <a
                                          href={resolveProfileImageUrl(file.filePath)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
                                        >
                                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                          <span className="truncate">{file.fileName}</span>
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </PopoverContent>
                              </Popover>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trades" className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5">
            {tradeNames.length === 0 ? (
              <EmptyPanel message="No trades assigned." />
            ) : (
              <ul className="flex flex-wrap gap-1.5 py-1">
                {tradeNames.map((name) => (
                  <li
                    key={name}
                    className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-medium"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="rates" className="mt-0 px-3 py-3 focus-visible:outline-none sm:px-4">
            <OperativeRatesPanel
              dailyRate={formatDailyRate(user.dailyRate)}
              cisName={user.cisName?.trim() || "—"}
              isDailyRate={Boolean(user.isDailyRate)}
              rateOverrides={rateOverrides}
            />
          </TabsContent>
        </Tabs>
      </section>

      <section className="flex flex-col gap-4 lg:col-span-4">
        <div className="card-elevated overflow-hidden">
          <div className="border-b px-4 py-3 sm:px-5">
            <h2 className="font-display font-semibold">Task status</h2>
            <p className="text-xs text-muted-foreground">
              Assigned task items — pending, in progress and completed
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
                No task item status data yet.
              </div>
            ) : pieTotal === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
                <span className="font-display text-2xl font-semibold text-foreground">
                  {statusCounts.total}
                </span>
                <span>Total items (none pending / in progress / completed)</span>
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
