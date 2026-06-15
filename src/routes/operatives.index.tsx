import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { operatives, fmtGBP } from "@/lib/data";
import { Plus, Search, Filter } from "lucide-react";

export const Route = createFileRoute("/operatives/")({
  head: () => ({ meta: [{ title: "Operatives — Schore" }] }),
  component: OperativesList,
});

function OperativesList() {
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState<string>("All");
  const trades = ["All", ...Array.from(new Set(operatives.map(o => o.trade)))];

  const rows = useMemo(() => operatives.filter(o => {
    const matchesQ = !q || o.name.toLowerCase().includes(q.toLowerCase()) || o.trade.toLowerCase().includes(q.toLowerCase());
    const matchesT = trade === "All" || o.trade === trade;
    return matchesQ && matchesT;
  }), [q, trade]);

  return (
    <div>
      <PageHeader
        title="Operatives"
        subtitle={`${operatives.length} operatives in the workforce builder`}
        actions={<Button size="sm" asChild><Link to="/operatives/new"><Plus className="h-4 w-4" />Add operative</Link></Button>}
      />

      <div className="card-elevated">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-80">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name or trade…" className="bg-transparent text-sm outline-none w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={trade} onChange={e=>setTrade(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {trades.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">{rows.length} result{rows.length===1?"":"s"}</div>
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm font-medium">No operatives match your filters</div>
            <div className="text-xs text-muted-foreground mt-1">Try clearing the search or trade filter.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Name</th>
                  <th className="text-left font-medium px-3 py-2.5">Trade</th>
                  <th className="text-left font-medium px-3 py-2.5">CIS</th>
                  <th className="text-right font-medium px-3 py-2.5">Daily Rate</th>
                  <th className="text-left font-medium px-3 py-2.5">UTR</th>
                  <th className="text-left font-medium px-3 py-2.5">Phone</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(o => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link to="/operatives/$id" params={{ id: o.id }} className="font-medium hover:text-info hover:underline">
                        {o.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">Joined {o.startDate}</div>
                    </td>
                    <td className="px-3 py-3">{o.trade}</td>
                    <td className="px-3 py-3"><code className="text-xs font-mono">{o.cis}</code></td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(o.dailyRate)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{o.utr || <span className="text-destructive">missing</span>}</td>
                    <td className="px-3 py-3 text-muted-foreground">{o.phone}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
