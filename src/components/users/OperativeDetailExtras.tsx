import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Label, Pie, PieChart } from "recharts";
import { Award, Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock, Coins, Database, Eye, FileText, FolderKanban, HeartPulse, IdCard, ListTodo, Loader2, MapPin, Paperclip, Percent, Plus, PoundSterling, Shield, TrendingUp, Wallet } from "lucide-react";
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
import { resolveProfileImageUrl, usersService, type ApiUser } from "@/lib/api/services/users";
import { tasksService } from "@/lib/api/services/tasks";
import { formatDailyRate } from "@/lib/module-ui";
import { formatUkDate } from "@/lib/week-ending";
import { formatSortCodeInput } from "@/lib/user-form";
import { isNonEmptyId } from "@/lib/ids";
import {
  certificationStatusFromExpiry,
  formatCertificationDisplayDate,
  formatCertificationExpiryRelative,
} from "@/lib/operative-certifications";
import { hierarchyReturnSearch } from "@/lib/hierarchy-navigation";
import { TASKS_ROUTE } from "@/lib/tasks";
import type { OperativeFormTab } from "@/components/users/UserFormFields";
import { cn } from "@/lib/utils";

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
  isTicked?: boolean,
) {
  if (isTicked) return "Completed";
  const code = (statusCode ?? "").toUpperCase();
  if (!code || code === "DRAFT") return "Pending";
  return statusName || statusCode || "Pending";
}

/** Item-level bucket only (Daily tick / item Status) — never the parent job status. */
function itemStatusBucket(item: {
  isTicked: boolean;
  statusCode: string | null;
}): "pending" | "inProgress" | "completed" | null {
  if (item.isTicked) return "completed";
  const code = (item.statusCode ?? "").toUpperCase();
  if (!code || code === "DRAFT" || code === "PENDING") return "pending";
  if (code === "IN_PROGRESS") return "inProgress";
  if (code === "COMPLETED") return "completed";
  return null;
}

export function OperativeDetailExtras({
  user,
  canEdit,
  onEdit,
}: {
  user: ApiUser;
  canEdit?: boolean;
  onEdit?: (tab?: OperativeFormTab) => void;
}) {
  const operativeId = String(user.id);
  const navigate = useNavigate();
  const canAddTask = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const [tab, setTab] = useState("tasks");
  const operativeReturnSearch = hierarchyReturnSearch({
    from: "operative",
    operativeId,
  });

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

  const workSummaryQuery = useQuery({
    queryKey: ["users", "work-summary", operativeId],
    queryFn: async () => (await usersService.getWorkSummary(operativeId)).data,
    enabled: isNonEmptyId(operativeId),
  });

  const items = itemsQuery.data?.items ?? [];

  // Same task-item rows as the Tasks table — not parent job (WorkTask) status.
  const statusCounts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    for (const item of items) {
      const bucket = itemStatusBucket(item);
      if (bucket === "pending") pending += 1;
      else if (bucket === "inProgress") inProgress += 1;
      else if (bucket === "completed") completed += 1;
    }
    return {
      pending,
      inProgress,
      completed,
      total: pending + inProgress + completed,
    };
  }, [items]);

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
  const chartLoading = itemsQuery.isLoading;

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
  const sites = workSummaryQuery.data?.sites ?? [];
  const projects = workSummaryQuery.data?.projects ?? [];
  const earnings = workSummaryQuery.data?.earnings;

  const addLabel =
    tab === "tasks"
      ? "Add task"
      : tab === "bank"
        ? "Edit payment details"
        : tab === "certificates"
          ? "Edit certificates"
          : tab === "sites" || tab === "projects"
            ? ""
            : "Edit rates";

  const showAdd =
    tab === "sites" || tab === "projects"
      ? false
      : tab === "tasks"
        ? canAddTask
        : Boolean(canEdit && onEdit);

  function handleAdd() {
    if (tab === "tasks") {
      navigate({
        to: "/tasks/new",
        search: { from: "operative", operativeId: String(operativeId) },
      });
      return;
    }
    const targetOperativeTab: OperativeFormTab =
      tab === "bank"
        ? "payment"
        : tab === "certificates"
          ? "certificates"
          : "rates";
    onEdit?.(targetOperativeTab);
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
                <TabsTrigger value="sites" className={underlineTabTriggerClass}>
                  Sites
                </TabsTrigger>
                <TabsTrigger value="projects" className={underlineTabTriggerClass}>
                  Projects
                </TabsTrigger>
                <TabsTrigger value="bank" className={underlineTabTriggerClass}>
                  Bank
                </TabsTrigger>
                <TabsTrigger value="certificates" className={underlineTabTriggerClass}>
                  Certificates
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
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate({
                        to: "/tasks/new",
                        search: { from: "operative", operativeId: String(operativeId) },
                      })
                    }
                  >
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
                          <StatusBadge status={itemStatusLabel(item.statusName, item.statusCode, item.isTicked)} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {canEdit ? (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                              <Link
                                to="/tasks/$id"
                                params={{ id: String(item.taskId) }}
                                search={{ mode: "view", from: "operative", operativeId }}
                                aria-label={`View ${item.taskNumber}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sites" className="mt-0 focus-visible:outline-none">
            {workSummaryQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sites…
              </div>
            ) : workSummaryQuery.isError ? (
              <EmptyPanel message="Unable to load sites for this operative." />
            ) : sites.length === 0 ? (
              <EmptyPanel message="No sites yet — sites appear when this operative is assigned to task items." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-1.5 text-left font-medium">Site</th>
                      <th className="px-3 py-1.5 text-left font-medium">Code</th>
                      <th className="px-3 py-1.5 text-left font-medium">Projects</th>
                      <th className="px-3 py-1.5 text-left font-medium">Items</th>
                      <th className="px-3 py-1.5 text-left font-medium">Last work</th>
                      <th className="px-4 py-1.5 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sites.map((site) => (
                      <tr key={site.siteId} className="hover:bg-muted/30">
                        <td className="px-4 py-1.5">
                          <div className="flex items-center gap-2 font-medium">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {site.siteName}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {site.siteCode?.trim() || "—"}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">{site.projectCount}</td>
                        <td className="px-3 py-1.5 tabular-nums">{site.itemCount}</td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {formatShortDate(site.lastWorkDate)}
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                            <Link
                              to="/sites/$id"
                              params={{ id: String(site.siteId) }}
                              search={operativeReturnSearch}
                              aria-label={`View ${site.siteName}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
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

          <TabsContent value="projects" className="mt-0 focus-visible:outline-none">
            {workSummaryQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading projects…
              </div>
            ) : workSummaryQuery.isError ? (
              <EmptyPanel message="Unable to load projects for this operative." />
            ) : projects.length === 0 ? (
              <EmptyPanel message="No projects yet — projects appear when this operative is assigned to task items." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-1.5 text-left font-medium">Project</th>
                      <th className="px-3 py-1.5 text-left font-medium">Code</th>
                      <th className="px-3 py-1.5 text-left font-medium">Site</th>
                      <th className="px-3 py-1.5 text-left font-medium">Properties</th>
                      <th className="px-3 py-1.5 text-left font-medium">Items</th>
                      <th className="px-3 py-1.5 text-left font-medium">Last work</th>
                      <th className="px-4 py-1.5 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {projects.map((project) => (
                      <tr key={project.projectId} className="hover:bg-muted/30">
                        <td className="px-4 py-1.5">
                          <div className="flex items-center gap-2 font-medium">
                            <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {project.projectName}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {project.projectCode?.trim() || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{project.siteName}</td>
                        <td className="px-3 py-1.5 tabular-nums">{project.propertyCount}</td>
                        <td className="px-3 py-1.5 tabular-nums">{project.itemCount}</td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {formatShortDate(project.lastWorkDate)}
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                            <Link
                              to="/projects/$id"
                              params={{ id: String(project.projectId) }}
                              search={operativeReturnSearch}
                              aria-label={`View ${project.projectName}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
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
          <div className="flex items-start gap-3 px-4 pb-1 pt-4 sm:px-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-info/15 text-info">
              <ListTodo className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-semibold">Task status</h2>
              <p className="text-xs text-muted-foreground">
                Per task item — pending, in progress and completed
              </p>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
            <div className="min-w-0">
              {chartLoading ? (
                <div className="flex h-[180px] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : pieTotal === 0 && statusCounts.total === 0 ? (
                <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                  No task item status data yet.
                </div>
              ) : pieTotal === 0 ? (
                <div className="flex h-[180px] flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
                  <span className="font-display text-2xl font-semibold text-foreground">
                    {statusCounts.total}
                  </span>
                  <span>Total items (none pending / in progress / completed)</span>
                </div>
              ) : (
                <ChartContainer
                  config={taskStatusChartConfig}
                  className="mx-auto aspect-square h-[180px] w-full max-w-[200px]"
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
                      innerRadius={48}
                      outerRadius={72}
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

            <div className="flex flex-col gap-2">
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
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab("tasks")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:opacity-90",
                    item.tone === "warn" && "border-warning/20 bg-warning/10",
                    item.tone === "info" && "border-info/20 bg-info/10",
                    item.tone === "ok" && "border-success/20 bg-success/10",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      item.tone === "warn" && "text-warning-foreground",
                      item.tone === "info" && "text-info",
                      item.tone === "ok" && "text-success",
                    )}
                  />
                  <span className="font-display text-base font-semibold tabular-nums">
                    {item.value}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">{item.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="flex items-start gap-3 px-4 pb-1 pt-4 sm:px-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
              <Coins className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-semibold">Earnings</h2>
              <p className="text-xs text-muted-foreground">
                Pay statements gross / net, plus completed price work
              </p>
            </div>
          </div>
          {workSummaryQuery.isLoading ? (
            <div className="flex h-[140px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : workSummaryQuery.isError ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
              Unable to load earnings.
            </p>
          ) : (
            <div className="space-y-4 p-4 pt-3 sm:p-5 sm:pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-success/20 bg-success/10 px-2.5 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Gross</span>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-success/15 text-success">
                      <TrendingUp className="h-3 w-3" />
                    </span>
                  </div>
                  <p className="font-display text-lg font-semibold tabular-nums tracking-tight leading-none">
                    {formatDailyRate(earnings?.totalGross ?? 0)}
                  </p>
                  <span className="mt-1.5 inline-flex rounded-full bg-success/20 px-1.5 py-0.5 text-[10px] font-medium text-success">
                    Total gross pay
                  </span>
                </div>
                <div className="rounded-lg border border-info/20 bg-info/10 px-2.5 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Net</span>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-info/15 text-info">
                      <Wallet className="h-3 w-3" />
                    </span>
                  </div>
                  <p className="font-display text-lg font-semibold tabular-nums tracking-tight leading-none">
                    {formatDailyRate(earnings?.totalNet ?? 0)}
                  </p>
                  <span className="mt-1.5 inline-flex rounded-full bg-info/20 px-1.5 py-0.5 text-[10px] font-medium text-info">
                    After deductions
                  </span>
                </div>
              </div>
              <dl className="divide-y text-sm">
                <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Coins className="h-3.5 w-3.5 shrink-0" />
                    CIS deducted
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatDailyRate(earnings?.totalCisDeduction ?? 0)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Statements
                  </dt>
                  <dd className="font-medium tabular-nums">{earnings?.statementCount ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    Latest week ending
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatShortDate(earnings?.latestWeekEnding)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5 last:pb-0">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <PoundSterling className="h-3.5 w-3.5 shrink-0" />
                    Completed price work
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatDailyRate(earnings?.completedPriceWork ?? 0)}
                  </dd>
                </div>
              </dl>
              {(sites.length > 0 || projects.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                  {sites.length > 0 &&
                    (sites.length === 1 ? (
                      <Link
                        to="/sites/$id"
                        params={{ id: String(sites[0]!.siteId) }}
                        search={operativeReturnSearch}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 transition-colors hover:bg-muted/80 hover:text-foreground"
                      >
                        <Building2 className="h-3 w-3" />
                        1 site
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTab("sites")}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 transition-colors hover:bg-muted/80 hover:text-foreground"
                      >
                        <Building2 className="h-3 w-3" />
                        {sites.length} sites
                      </button>
                    ))}
                  {projects.length > 0 &&
                    (projects.length === 1 ? (
                      <Link
                        to="/projects/$id"
                        params={{ id: String(projects[0]!.projectId) }}
                        search={operativeReturnSearch}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 transition-colors hover:bg-muted/80 hover:text-foreground"
                      >
                        <FolderKanban className="h-3 w-3" />
                        1 project
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTab("projects")}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 transition-colors hover:bg-muted/80 hover:text-foreground"
                      >
                        <FolderKanban className="h-3 w-3" />
                        {projects.length} projects
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
