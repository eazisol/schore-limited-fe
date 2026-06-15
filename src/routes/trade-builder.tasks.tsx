import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus, Edit } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtGBP } from "@/lib/data";

export const Route = createFileRoute("/trade-builder/tasks")({ component: Tasks });

const tasks = [
  { code: "FD",   name: "Fire Door",       trade: "Carpenter",   group: "Doors",   unit: "per door",  rate: 90,  status: "Active", flags: ["Tick"] },
  { code: "PF",   name: "Ply Door",        trade: "Carpenter",   group: "Doors",   unit: "per door",  rate: 70,  status: "Active", flags: ["Tick"] },
  { code: "BX",   name: "Box In",          trade: "Carpenter",   group: "Extra",   unit: "per job",   rate: 60,  status: "Active", flags: ["Extra"] },
  { code: "SW",   name: "Stud Wall",       trade: "Carpenter",   group: "Walls",   unit: "per m²",    rate: 38,  status: "Active", flags: ["Measured"] },
  { code: "PW",   name: "Partition Wall",  trade: "Carpenter",   group: "Walls",   unit: "per m²",    rate: 42,  status: "Active", flags: ["Measured"] },
  { code: "PB",   name: "Plasterboard",    trade: "Plasterer",   group: "Skim",    unit: "per board", rate: 22,  status: "Active", flags: ["Measured"] },
  { code: "KF",   name: "Kitchen Fit",     trade: "Carpenter",   group: "KF",      unit: "per item",  rate: 240, status: "Active", flags: ["Package"] },
];

function Tasks() {
  return (
    <div>
      <div className="card-elevated mb-4 p-4 flex justify-end">
        <Button size="sm" onClick={() => toast("Add task", { description: "Open the task builder." })}><Plus className="h-4 w-4" />New task</Button>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Code</th><th className="px-3 py-3 text-left">Task</th><th className="px-3 py-3 text-left">Trade</th>
              <th className="px-3 py-3 text-left">Group</th><th className="px-3 py-3 text-left">Unit</th>
              <th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-left">Flags</th>
              <th className="px-3 py-3 text-left">Status</th><th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map(t => (
              <tr key={t.code} className="hover:bg-muted/30">
                <td className="px-5 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{t.code}</code></td>
                <td className="px-3 py-3 font-medium">{t.name}</td>
                <td className="px-3 py-3 text-muted-foreground">{t.trade}</td>
                <td className="px-3 py-3 text-muted-foreground">{t.group}</td>
                <td className="px-3 py-3 text-muted-foreground">{t.unit}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(t.rate)}</td>
                <td className="px-3 py-3"><div className="flex gap-1">{t.flags.map(f => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info">{f}</span>)}</div></td>
                <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-5 py-3 text-right"><button onClick={() => toast(`Edit ${t.code}`, { description: t.name })} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
