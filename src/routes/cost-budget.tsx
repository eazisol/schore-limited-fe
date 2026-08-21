import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import { holidaysService } from "@/lib/api/services/holidays";
import { costBudgetService } from "@/lib/api/services/cost-budget";
import { usersService } from "@/lib/api/services/users";
import { USER_TYPE_ID } from "@/lib/user-module";
import { downloadCsv, formatUkDate, getWeekEndingDate, toYmd } from "@/lib/week-ending";

export const Route = createFileRoute("/cost-budget")({
  head: () => ({ meta: [{ title: "Cost & Budget | Schore" }] }),
  component: CostBudget,
});

function CostBudget() {
  const weekendQuery = useQuery({
    queryKey: ["holidays", "weekend"],
    queryFn: async () => (await holidaysService.getWeekend()).data,
  });
  const defaultWeek = useMemo(() => {
    const weekend = weekendQuery.data;
    if (!weekend) return toYmd(new Date());
    return toYmd(getWeekEndingDate(new Date(), weekend.days, weekend.weekEndingDay));
  }, [weekendQuery.data]);
  const [weekEnding, setWeek] = useState("");
  const selectedWeek = weekEnding || defaultWeek;
  const [contractorId, setContractorId] = useState<number | "all">("all");
  const [allTime, setAllTime] = useState(false);

  const contractorsQuery = useQuery({
    queryKey: ["users", "dropdown", "contractors"],
    queryFn: async () =>
      (await usersService.dropdown({ userTypeId: USER_TYPE_ID.contractor })).data ?? [],
  });

  const query = useQuery({
    queryKey: ["cost-budget", { selectedWeek, contractorId, allTime }],
    queryFn: async () =>
      (
        await costBudgetService.get({
          weekEnding: allTime ? undefined : selectedWeek,
          contractorId: contractorId === "all" ? undefined : contractorId,
        })
      ).data,
    enabled: allTime || Boolean(selectedWeek),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const contractors = data?.contractors ?? [];
  const tasks = data?.tasks ?? [];
  const ledger = data?.ledger ?? [];

  const exportCsv = () => {
    if (contractorId === "all" && contractors.length > 1) {
      for (const contractor of contractors) {
        const rows = tasks.filter((t) => t.contractorId === contractor.contractorId);
        downloadCsv(
          `cost-budget-${contractor.contractorName.replaceAll(" ", "-")}.csv`,
          taskCsv(rows),
        );
      }
      toast.success(`Exported ${contractors.length} contractor files`);
      return;
    }
    downloadCsv("cost-budget.csv", taskCsv(tasks));
    toast.success("Exported cost & budget");
  };

  return (
    <div>
      <PageHeader
        title="Cost & Budget"
        subtitle="Spent = ticked price work + equal daily top-up share vs task budget. Contractors never mix on export."
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={tasks.length === 0}>
            <Download className="h-4 w-4" />Export
          </Button>
        }
      />

      <div className="card-elevated mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Week ending</span>
          <input
            type="date"
            value={selectedWeek}
            disabled={allTime}
            onChange={(e) => setWeek(e.target.value)}
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          />
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} />
          All time
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Contractor</span>
          <select
            value={contractorId === "all" ? "all" : String(contractorId)}
            onChange={(e) => setContractorId(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All (separate on export)</option>
            {(contractorsQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {data?.overBudgetCount ? (
          <span className="inline-flex items-center gap-1 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {data.overBudgetCount} task{data.overBudgetCount === 1 ? "" : "s"} over budget
          </span>
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {contractors.map((c) => {
          const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
          return (
            <div key={c.contractorId} className="card-elevated p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{c.contractorName}</h3>
                {c.overBudgetTaskCount > 0 && (
                  <span className="text-xs text-destructive">{c.overBudgetTaskCount} over budget</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-muted-foreground">Budget</div>
                  <div className="font-mono">{fmtGBP(c.budget)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Spent</div>
                  <div className="font-mono">{fmtGBP(c.spent)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Remaining</div>
                  <div className={`font-mono ${c.remaining < 0 ? "text-destructive" : "text-success"}`}>
                    {fmtGBP(c.remaining)}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full ${pct > 90 ? "bg-destructive" : "bg-accent"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
        {contractors.length === 0 && !query.isLoading && (
          <div className="card-elevated p-5 text-sm text-muted-foreground">No contractor cost yet for this filter.</div>
        )}
      </div>

      <div className="card-elevated mb-6 overflow-hidden">
        <div className="border-b px-5 py-3 font-semibold">Task budget tracking</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Task</th>
              <th className="px-3 py-3 text-left">Property</th>
              <th className="px-3 py-3 text-left">Contractor</th>
              <th className="px-3 py-3 text-right">Budget</th>
              <th className="px-3 py-3 text-right">Price work</th>
              <th className="px-3 py-3 text-right">Top-up</th>
              <th className="px-3 py-3 text-right">Spent</th>
              <th className="px-3 py-3 text-right">Remaining</th>
              <th className="px-5 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((t) => (
              <tr key={t.taskId} className={t.isOverBudget ? "bg-destructive/5" : "hover:bg-muted/30"}>
                <td className="px-5 py-3 font-mono text-xs">{t.taskNumber}</td>
                <td className="px-3 py-3 font-medium">{t.propertyName}</td>
                <td className="px-3 py-3 text-muted-foreground">{t.contractorName ?? "—"}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {t.budget == null ? "—" : fmtGBP(t.budget)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(t.priceWork)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(t.topUpShare)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(t.spent)}</td>
                <td
                  className={`px-3 py-3 text-right font-mono tabular-nums ${t.isOverBudget ? "text-destructive" : ""}`}
                >
                  {t.remaining == null ? "—" : fmtGBP(t.remaining)}
                </td>
                <td className="px-5 py-3">
                  {t.isOverBudget && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />Over budget
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!query.isLoading && tasks.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No task cost for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="border-b px-5 py-3 font-semibold">Cost ledger</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-left">Property</th>
              <th className="px-3 py-3 text-left">Operative</th>
              <th className="px-3 py-3 text-left">Task</th>
              <th className="px-3 py-3 text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ledger.map((line, index) => (
              <tr key={`${line.taskId}-${line.operativeId}-${line.workDate}-${index}`} className="hover:bg-muted/30">
                <td className="px-5 py-3 text-muted-foreground">{formatUkDate(line.workDate)}</td>
                <td className="px-3 py-3 font-medium">{line.propertyName}</td>
                <td className="px-3 py-3">{line.operativeName}</td>
                <td className="px-3 py-3">
                  <code className="mr-2 rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">{line.taskNumber}</code>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(line.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function taskCsv(rows: { taskNumber: string; propertyName: string; contractorName: string | null; budget: number | null; priceWork: number; topUpShare: number; spent: number; remaining: number | null; isOverBudget: boolean }[]) {
  return [
    ["Task", "Property", "Contractor", "Budget", "Price work", "Top-up", "Spent", "Remaining", "Over budget"],
    ...rows.map((t) => [
      t.taskNumber,
      t.propertyName,
      t.contractorName ?? "",
      t.budget == null ? "" : String(t.budget),
      String(t.priceWork),
      String(t.topUpShare),
      String(t.spent),
      t.remaining == null ? "" : String(t.remaining),
      t.isOverBudget ? "Yes" : "No",
    ]),
  ];
}
