import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Search } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/trade-builder/")({ component: Trades });

const seed = [
  { name: "Carpenter",   groups: 4, tasks: 18, status: "Active" },
  { name: "Plumber",     groups: 3, tasks: 11, status: "Active" },
  { name: "Electrician", groups: 3, tasks: 9,  status: "Active" },
  { name: "Tiler",       groups: 2, tasks: 6,  status: "Active" },
  { name: "Labourer",    groups: 2, tasks: 5,  status: "Active" },
  { name: "Painter",     groups: 2, tasks: 7,  status: "Active" },
  { name: "Plasterer",   groups: 1, tasks: 3,  status: "Inactive" },
];

function Trades() {
  const [q, setQ] = useState("");
  const rows = seed.filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="card-elevated mb-4 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search trade…" className="bg-transparent text-sm outline-none w-full" />
        </div>
        <Button size="sm" className="ml-auto" onClick={() => toast("Add trade", { description: "Opens the trade creation form (CEO/CM only)." })}><Plus className="h-4 w-4" />New trade</Button>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Trade</th><th className="px-3 py-3 text-right">Groups</th><th className="px-3 py-3 text-right">Tasks</th><th className="px-3 py-3 text-left">Status</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.name} className="hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{r.groups}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{r.tasks}</td>
                <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-5 py-3 text-right"><button onClick={() => toast(`Edit ${r.name}`)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No trades match your search.</div>}
      </div>
    </div>
  );
}
