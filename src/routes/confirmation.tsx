import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { allocations, operatives, properties, fmtGBP } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/confirmation")({
  head: () => ({ meta: [{ title: "Work Confirmation | Schore" }] }),
  component: Confirmation,
});

function Confirmation() {
  const [ticked, setTicked] = useState<Record<string, boolean>>(
    Object.fromEntries(allocations.map(a => [a.id, a.status === "Ticked"]))
  );
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setTicked(s => ({ ...s, [id]: !s[id] }));

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    const count = Object.values(ticked).filter(Boolean).length;
    toast.success(`${count} line(s) confirmed`, { description: "No tick = no pay. Unticked lines won't be paid this week." });
  };

  return (
    <div>
      <PageHeader
        title="Work Confirmation"
        subtitle="Tick each completed line. Untick = no pay this week."
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Check className="h-4 w-4" />Confirm work</>}
          </Button>
        }
      />
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 text-center w-12">Tick</th>
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-left">Property</th>
              <th className="px-3 py-3 text-left">Operative</th>
              <th className="px-3 py-3 text-left">Work line</th>
              <th className="px-3 py-3 text-right">Amount</th>
              <th className="px-3 py-3 text-left">Comments</th>
              <th className="px-3 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {allocations.map(a => {
              const p = properties.find(x => x.id === a.propertyId)!;
              const o = operatives.find(x => x.id === a.operativeId)!;
              return (
                <tr key={a.id} className={ticked[a.id] ? "bg-success/5" : ""}>
                  <td className="px-3 py-3 text-center">
                    <input type="checkbox" checked={!!ticked[a.id]} onChange={()=>toggle(a.id)} disabled={a.status==="Locked"} className="h-4 w-4" />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{a.date}</td>
                  <td className="px-3 py-3 font-medium">{p.ref}</td>
                  <td className="px-3 py-3">{o.name}</td>
                  <td className="px-3 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded mr-2">{a.code}</code>{a.description}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(a.value)}</td>
                  <td className="px-3 py-3">
                    <input
                      value={comments[a.id] ?? ""}
                      onChange={e=>setComments(c=>({...c,[a.id]:e.target.value}))}
                      placeholder="Add note…"
                      className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    />
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
