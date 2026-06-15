import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { rates, fmtGBP } from "@/lib/data";
import { Plus, Edit, Search } from "lucide-react";

export const Route = createFileRoute("/rates")({
  head: () => ({ meta: [{ title: "Rate Catalogue — Schore" }] }),
  component: Rates,
});

function Rates() {
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState("All");
  const trades = ["All", ...Array.from(new Set(rates.map(r => r.trade)))];

  const rows = rates.filter(r =>
    (trade === "All" || r.trade === trade) &&
    (!q || r.task.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase()))
  );

  // group by trade > group
  const groups: Record<string, Record<string, typeof rates>> = {};
  rows.forEach(r => {
    groups[r.trade] = groups[r.trade] || {};
    groups[r.trade][r.group] = groups[r.trade][r.group] || [];
    groups[r.trade][r.group].push(r);
  });

  return (
    <div>
      <PageHeader
        title="Rate Catalogue"
        subtitle="CEO / CM / PM can edit · SM can view but not edit"
        actions={<Button size="sm"><Plus className="h-4 w-4" />New rate</Button>}
      />

      <div className="card-elevated mb-6">
        <div className="p-4 flex flex-wrap gap-3 border-b">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search task or code…" className="bg-transparent text-sm outline-none w-full" />
          </div>
          <select value={trade} onChange={e=>setTrade(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {trades.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groups).map(([tradeName, gs]) => (
          <div key={tradeName} className="card-elevated">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="font-display font-semibold">{tradeName}</h2>
                <p className="text-xs text-muted-foreground">{Object.values(gs).flat().length} tasks across {Object.keys(gs).length} groups</p>
              </div>
              <Button variant="outline" size="sm"><Plus className="h-4 w-4" />Add task</Button>
            </div>
            {Object.entries(gs).map(([groupName, items]) => (
              <div key={groupName} className="border-b last:border-0">
                <div className="px-5 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">{groupName}</div>
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {items.map(r => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3 w-20"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{r.code}</code></td>
                        <td className="px-3 py-3">{r.task}</td>
                        <td className="px-3 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${r.payType === "Price" ? "bg-info/10 text-info" : "bg-accent/15 text-accent-foreground"}`}>{r.payType}</span></td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(r.rate)}{r.unit && <span className="text-xs text-muted-foreground ml-1">{r.unit}</span>}</td>
                        <td className="px-5 py-3 text-right">
                          <button className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <div className="text-sm font-medium">No rates match your search</div>
            <p className="text-xs text-muted-foreground mt-1">The firm owns this catalogue. Add a rate to extend the engine.</p>
          </div>
        )}
      </div>
    </div>
  );
}
