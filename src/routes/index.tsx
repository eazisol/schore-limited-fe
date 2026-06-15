import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { properties, operatives, wageSheets, allocations, contracts, fmtGBP, getOperative, getProperty } from "@/lib/data";
import { ArrowUpRight, Building2, Users, Receipt, TrendingUp, AlertTriangle, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Schore Limited" }] }),
  component: Dashboard,
});

function Dashboard() {
  const inProgress = properties.filter(p => p.status === "In Progress").length;
  const handedOver = properties.filter(p => p.status === "Handed Over").length;
  const onSiteOps = new Set(allocations.filter(a => a.status !== "Locked").map(a => a.operativeId)).size;
  const pendingWages = wageSheets.filter(w => w.status === "Pending" || w.status === "Draft").length;
  const totalSpent = contracts.reduce((s, c) => s + c.spent, 0);
  const totalBudget = contracts.reduce((s, c) => s + c.budget, 0);
  const heldCount = properties.filter(p => p.heldDays > 0).length;

  const stats = [
    { label: "Properties In Progress", value: inProgress, sub: `${handedOver} handed over this month`, icon: Building2, trend: "+2" },
    { label: "Operatives On Site", value: onSiteOps, sub: `${operatives.filter(o=>o.status==="Active").length} active overall`, icon: Users, trend: "+1" },
    { label: "Wage Sheets to Action", value: pendingWages, sub: "Week ending 23/01/26", icon: Receipt, trend: null },
    { label: "Spend vs Budget", value: `${Math.round(totalSpent / totalBudget * 100)}%`, sub: `${fmtGBP(totalSpent)} of ${fmtGBP(totalBudget)}`, icon: TrendingUp, trend: null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Dashboard"
        subtitle="Friday, 23 January 2026 · Week 04"
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link to="/daily">Open today's roll</Link></Button>
            <Button size="sm" asChild><Link to="/operatives/new"><Plus className="h-4 w-4" />New operative</Link></Button>
          </>
        }
      />

      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="card-elevated p-5">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              {s.trend && <span className="text-xs font-medium text-success">{s.trend}</span>}
            </div>
            <div className="mt-4 text-3xl font-display font-semibold tracking-tight">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            <div className="text-[11px] text-muted-foreground/80 mt-2">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Today's allocations */}
        <div className="xl:col-span-2 card-elevated">
          <div className="flex items-center justify-between p-5 border-b">
            <div>
              <h2 className="font-display font-semibold">Today's Allocations</h2>
              <p className="text-xs text-muted-foreground">Live from the Master · ticking required before next day</p>
            </div>
            <Link to="/daily" className="text-xs font-medium text-info inline-flex items-center gap-1 hover:underline">
              Open Daily Programme <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Property</th>
                  <th className="text-left font-medium px-3 py-2.5">Operative</th>
                  <th className="text-left font-medium px-3 py-2.5">Code</th>
                  <th className="text-left font-medium px-3 py-2.5">Time</th>
                  <th className="text-right font-medium px-3 py-2.5">Value</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allocations.map(a => {
                  const op = getOperative(a.operativeId);
                  const pr = getProperty(a.propertyId);
                  return (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <div className="font-medium">{pr?.ref}</div>
                        <div className="text-xs text-muted-foreground">{pr?.contract} · {pr?.postcode}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{op?.name}</div>
                        <div className="text-xs text-muted-foreground">{op?.trade}</div>
                      </td>
                      <td className="px-3 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{a.code}</code></td>
                      <td className="px-3 py-3 text-muted-foreground">{a.time}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{a.value ? fmtGBP(a.value) : "—"}</td>
                      <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contract budgets */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Contract Budgets</h2>
            <Link to="/contracts" className="text-xs text-info hover:underline">View all</Link>
          </div>
          <div className="space-y-5">
            {contracts.map(c => {
              const pct = Math.round(c.spent / c.budget * 100);
              const over = pct > 90;
              return (
                <div key={c.id}>
                  <div className="flex justify-between items-baseline">
                    <div>
                      <div className="font-medium text-sm">{c.client}</div>
                      <div className="text-xs text-muted-foreground">{c.site}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono tabular-nums">{fmtGBP(c.spent)}</div>
                      <div className="text-[11px] text-muted-foreground">of {fmtGBP(c.budget)}</div>
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full ${over ? "bg-destructive" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Prelims {fmtGBP(c.prelims)}</span>
                    <span className={over ? "text-destructive font-medium" : ""}>{pct}% spent</span>
                  </div>
                </div>
              );
            })}
          </div>

          {heldCount > 0 && (
            <div className="mt-5 p-3 rounded-md border border-warning/30 bg-warning/10 flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-medium">{heldCount} {heldCount === 1 ? "property is" : "properties are"} on Hold.</span>{" "}
                Held days excluded from KPI clock.{" "}
                <Link to="/kpi" className="underline">Review</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
