import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Search } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/legend-codes")({
  head: () => ({ meta: [{ title: "Legend Codes — Schore" }] }),
  component: Legends,
});

const legends = [
  { code: "L",   meaning: "Labourer",            trade: "Labourer",    pay: "Day Work",   split: false, isStatus: false },
  { code: "Pl",  meaning: "Plumber",             trade: "Plumber",     pay: "Day Work",   split: false, isStatus: false },
  { code: "E",   meaning: "Electrician",         trade: "Electrician", pay: "Day Work",   split: false, isStatus: false },
  { code: "C1",  meaning: "Carcass 1",           trade: "Carpenter",   pay: "Price Work", split: true,  isStatus: false },
  { code: "C2",  meaning: "Carcass 2",           trade: "Carpenter",   pay: "Price Work", split: true,  isStatus: false },
  { code: "C3",  meaning: "Carcass 3",           trade: "Carpenter",   pay: "Price Work", split: true,  isStatus: false },
  { code: "KF",  meaning: "Kitchen Fit",         trade: "Carpenter",   pay: "Price Work", split: false, isStatus: false },
  { code: "T",   meaning: "Tiler",               trade: "Tiler",       pay: "Price Work", split: false, isStatus: false },
  { code: "D",   meaning: "Decorator",           trade: "Painter",     pay: "Price Work", split: false, isStatus: false },
  { code: "V",   meaning: "Void",                trade: "—",           pay: "—",          split: false, isStatus: true  },
  { code: "HM",  meaning: "Held — Materials",    trade: "—",           pay: "—",          split: false, isStatus: true  },
  { code: "RFH", meaning: "Reroute Floor Heat",  trade: "Plumber",     pay: "Price Work", split: false, isStatus: false },
  { code: "ASB", meaning: "Asbestos delay",      trade: "—",           pay: "—",          split: false, isStatus: true  },
  { code: "S1",  meaning: "Snag 1",              trade: "—",           pay: "—",          split: false, isStatus: true  },
];

function Legends() {
  const [q, setQ] = useState("");
  const rows = legends.filter(l => !q || l.code.toLowerCase().includes(q.toLowerCase()) || l.meaning.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader
        title="Legend Codes"
        subtitle="Single source of truth for codes used on the Daily Programme."
        actions={<Button size="sm" onClick={() => toast("New legend", { description: "Add a legend code (Admin only)." })}><Plus className="h-4 w-4" />New legend</Button>}
      />
      <div className="card-elevated mb-4 p-4">
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search code or meaning…" className="bg-transparent text-sm outline-none w-full" />
        </div>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Code</th><th className="px-3 py-3 text-left">Meaning</th>
              <th className="px-3 py-3 text-left">Trade</th><th className="px-3 py-3 text-left">Pay Type</th>
              <th className="px-3 py-3 text-left">Cost Split</th><th className="px-3 py-3 text-left">Type</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(l => (
              <tr key={l.code} className="hover:bg-muted/30">
                <td className="px-5 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{l.code}</code></td>
                <td className="px-3 py-3 font-medium">{l.meaning}</td>
                <td className="px-3 py-3 text-muted-foreground">{l.trade}</td>
                <td className="px-3 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${l.pay === "Price Work" ? "bg-info/10 text-info" : l.pay === "Day Work" ? "bg-accent/15 text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{l.pay}</span></td>
                <td className="px-3 py-3 text-muted-foreground">{l.split ? "Yes" : "No"}</td>
                <td className="px-3 py-3">{l.isStatus ? <StatusBadge status="On Hold" /> : <span className="text-[11px] text-muted-foreground">Work</span>}</td>
                <td className="px-5 py-3 text-right"><button onClick={() => toast(`Edit ${l.code}`)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
