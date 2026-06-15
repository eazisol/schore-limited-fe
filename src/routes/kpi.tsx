import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { properties, holdReasons } from "@/lib/data";
import { Plus, Pause, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/kpi")({
  head: () => ({ meta: [{ title: "KPI & Hold Board — Schore" }] }),
  component: KPI,
});

const target = (type: string) => type === "KBWC" ? 15 : type === "Kitchen" ? 11 : 9;

function KPI() {
  const [reasons, setReasons] = useState(holdReasons);
  const [newReason, setNewReason] = useState("");

  return (
    <div className="space-y-6">
      <PageHeader title="KPI & Hold Board" subtitle="Target durations: Bathroom/Wet 8–10 days · Kitchen 10–12 · KBWC 15. Held days are excluded." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-elevated">
          <div className="p-5 border-b">
            <h3 className="font-display font-semibold">Property KPI tracker</h3>
            <p className="text-xs text-muted-foreground">Working days vs target · {properties.filter(p=>p.heldDays>0).length} properties currently held</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">Property</th>
                <th className="text-left font-medium px-3 py-2.5">Type</th>
                <th className="text-right font-medium px-3 py-2.5">Days</th>
                <th className="text-right font-medium px-3 py-2.5">Held</th>
                <th className="text-right font-medium px-3 py-2.5">KPI / Target</th>
                <th className="text-left font-medium px-5 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {properties.filter(p => p.status !== "Handed Over").map(p => {
                const kpi = p.daysOnSite - p.heldDays;
                const t = target(p.type);
                const over = kpi > t;
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium">{p.ref}</div>
                      <StatusBadge status={p.status} className="mt-1" />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{p.type}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{p.daysOnSite}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{p.heldDays > 0 ? <span className="text-warning-foreground">{p.heldDays}</span> : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      <span className={over ? "text-destructive font-medium" : "text-success font-medium"}>{kpi}</span>
                      <span className="text-muted-foreground"> / {t}</span>
                    </td>
                    <td className="px-5 py-3">
                      {p.status === "On Hold" ? (
                        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-info hover:underline" onClick={()=>toast.success(`${p.ref} hold lifted`)}>
                          <Play className="h-3 w-3" /> Lift hold
                        </button>
                      ) : (
                        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={()=>toast(`${p.ref} held`, { description: "Day excluded from KPI" })}>
                          <Pause className="h-3 w-3" /> Hold
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card-elevated p-6">
          <h3 className="font-display font-semibold mb-1">Hold reasons</h3>
          <p className="text-xs text-muted-foreground mb-4">Custom list owned by the firm · dated evidence for delay/variation claims</p>

          <ul className="space-y-2 mb-4">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-center justify-between p-2.5 rounded-md bg-secondary text-sm">
                <span>{r}</span>
                <button className="text-xs text-destructive hover:underline" onClick={() => setReasons(reasons.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <input value={newReason} onChange={e=>setNewReason(e.target.value)} placeholder="Add new reason…" className="input" />
            <Button size="sm" onClick={() => { if (newReason.trim()) { setReasons([...reasons, newReason]); setNewReason(""); toast.success("Reason added"); } }}>
              <Plus className="h-4 w-4" />Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
