import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { properties, contracts, allocations, operatives, fmtGBP } from "@/lib/data";

export const Route = createFileRoute("/cost-budget")({
  head: () => ({ meta: [{ title: "Cost & Budget | Schore" }] }),
  component: CostBudget,
});

function CostBudget() {
  const [contract, setContract] = useState<"All" | "MS" | "John">("All");
  const props = properties.filter(p => contract === "All" || p.contract === contract);

  return (
    <div>
      <PageHeader
        title="Cost & Budget"
        subtitle="Per-property ledger and budget tracking across both contracts."
        actions={<Button size="sm" variant="outline" onClick={()=>toast.success("Exported budget variance (.xlsx)")}><Download className="h-4 w-4" />Export</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {contracts.map(c => {
          const remaining = c.budget - c.spent;
          const pct = Math.round(c.spent / c.budget * 100);
          return (
            <div key={c.id} className="card-elevated p-5">
              <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">{c.client}</h3><span className="text-xs text-muted-foreground">{c.id}</span></div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><div className="text-[11px] text-muted-foreground">Budget</div><div className="font-mono">{fmtGBP(c.budget)}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Spent</div><div className="font-mono">{fmtGBP(c.spent)}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Remaining</div><div className={`font-mono ${remaining < 0 ? "text-destructive" : "text-success"}`}>{fmtGBP(remaining)}</div></div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden"><div className={`h-full ${pct > 90 ? "bg-destructive" : "bg-accent"}`} style={{width:`${Math.min(pct,100)}%`}} /></div>
            </div>
          );
        })}
      </div>

      <div className="card-elevated mb-4 p-4">
        <select value={contract} onChange={e=>setContract(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option>All</option><option value="MS">MS</option><option value="John">John</option>
        </select>
      </div>

      <div className="card-elevated overflow-hidden mb-6">
        <div className="px-5 py-3 border-b font-semibold">Property budget tracking</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Property</th><th className="px-3 py-3 text-left">Contract</th><th className="px-3 py-3 text-right">Budget</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3 text-right">Remaining</th><th className="px-3 py-3 text-right">Variance</th><th className="px-5 py-3 text-left"></th></tr>
          </thead>
          <tbody className="divide-y">
            {props.map(p => {
              const remaining = p.budget - p.spent;
              const variance = -remaining;
              const over = remaining < 0;
              return (
                <tr key={p.id} className={over ? "bg-destructive/5" : "hover:bg-muted/30"}>
                  <td className="px-5 py-3 font-medium">{p.ref}</td>
                  <td className="px-3 py-3 text-muted-foreground">{p.contract}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(p.budget)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(p.spent)}</td>
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${over?"text-destructive":""}`}>{fmtGBP(remaining)}</td>
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${over?"text-destructive":"text-success"}`}>{variance >= 0 ? "+" : ""}{fmtGBP(variance)}</td>
                  <td className="px-5 py-3">{over && <span className="inline-flex items-center gap-1 text-[11px] text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Over budget</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold">Recent property cost ledger</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Property</th><th className="px-3 py-3 text-left">Operative</th><th className="px-3 py-3 text-left">Task</th><th className="px-3 py-3 text-right">Cost</th></tr>
          </thead>
          <tbody className="divide-y">
            {allocations.map(a => {
              const p = properties.find(x => x.id === a.propertyId);
              const o = operatives.find(x => x.id === a.operativeId);
              return (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 text-muted-foreground">{a.date}</td>
                  <td className="px-3 py-3 font-medium">{p?.ref}</td>
                  <td className="px-3 py-3">{o?.name}</td>
                  <td className="px-3 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded mr-2">{a.code}</code>{a.description}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(a.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
