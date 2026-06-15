import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus, Edit } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/trade-builder/groups")({ component: Groups });

const groups = [
  { code: "KF",  name: "Kitchen Fit",   trade: "Carpenter",   order: 1, status: "Active" },
  { code: "C1",  name: "Carcass 1",     trade: "Carpenter",   order: 2, status: "Active" },
  { code: "C2",  name: "Carcass 2",     trade: "Carpenter",   order: 3, status: "Active" },
  { code: "C3",  name: "Carcass 3",     trade: "Carpenter",   order: 4, status: "Active" },
  { code: "DW",  name: "Day Work",      trade: "All",         order: 5, status: "Active" },
  { code: "EW",  name: "Extra Work",    trade: "All",         order: 6, status: "Active" },
  { code: "T-W", name: "Wall Tiling",   trade: "Tiler",       order: 1, status: "Active" },
  { code: "Pl1", name: "1st Fix Plumb", trade: "Plumber",     order: 1, status: "Active" },
];

function Groups() {
  return (
    <div>
      <div className="card-elevated mb-4 p-4 flex justify-end">
        <Button size="sm" onClick={() => toast("Add group", { description: "Create a new trade group (e.g. KF, C2)." })}><Plus className="h-4 w-4" />New group</Button>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Code</th><th className="px-3 py-3 text-left">Name</th><th className="px-3 py-3 text-left">Trade</th><th className="px-3 py-3 text-right">Order</th><th className="px-3 py-3 text-left">Status</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {groups.map(g => (
              <tr key={g.code} className="hover:bg-muted/30">
                <td className="px-5 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{g.code}</code></td>
                <td className="px-3 py-3 font-medium">{g.name}</td>
                <td className="px-3 py-3 text-muted-foreground">{g.trade}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{g.order}</td>
                <td className="px-3 py-3"><StatusBadge status={g.status} /></td>
                <td className="px-5 py-3 text-right"><button onClick={() => toast(`Edit ${g.code}`)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
