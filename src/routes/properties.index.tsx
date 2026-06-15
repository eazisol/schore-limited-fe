import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { properties, fmtGBP } from "@/lib/data";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/properties/")({
  head: () => ({ meta: [{ title: "Properties — Schore" }] }),
  component: PropertiesList,
});

function PropertiesList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [contract, setContract] = useState("All");

  const rows = useMemo(() => properties.filter(p => {
    if (q && !p.address.toLowerCase().includes(q.toLowerCase()) && !p.postcode.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "All" && p.status !== status) return false;
    if (contract !== "All" && p.contract !== contract) return false;
    return true;
  }), [q, status, contract]);

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={`${rows.length} properties · KPI clock pauses on held days`}
        actions={<Button size="sm" onClick={() => toast("Add property", { description: "The new-property workflow opens here. Connect to your contracts to enable." })}><Plus className="h-4 w-4" />Add property</Button>}
      />

      <div className="card-elevated">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Address or postcode…" className="bg-transparent text-sm outline-none w-full" />
          </div>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {["All","In Progress","Handed Over","On Hold","Snag"].map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={contract} onChange={e=>setContract(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {["All","MS","John"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">Property</th>
                <th className="text-left font-medium px-3 py-2.5">Contract</th>
                <th className="text-left font-medium px-3 py-2.5">Type</th>
                <th className="text-left font-medium px-3 py-2.5">Site Manager</th>
                <th className="text-right font-medium px-3 py-2.5">Days / Held</th>
                <th className="text-right font-medium px-3 py-2.5">Budget</th>
                <th className="text-left font-medium px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(p => {
                const pct = Math.round(p.spent / p.budget * 100);
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link to="/properties/$id" params={{ id: p.id }} className="font-medium hover:text-info hover:underline">{p.ref}</Link>
                      <div className="text-[11px] text-muted-foreground">{p.address} · {p.postcode}</div>
                    </td>
                    <td className="px-3 py-3"><code className="text-xs font-mono">{p.contract}</code></td>
                    <td className="px-3 py-3">{p.type}</td>
                    <td className="px-3 py-3 text-muted-foreground">{p.siteManager}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{p.daysOnSite}{p.heldDays > 0 && <span className="text-warning-foreground"> ({p.heldDays}h)</span>}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-mono tabular-nums text-xs">{fmtGBP(p.spent)} / {fmtGBP(p.budget)}</div>
                      <div className={`text-[10px] ${pct>90?"text-destructive":"text-muted-foreground"}`}>{pct}%</div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No properties match your filters.</div>}
        </div>
      </div>
    </div>
  );
}
