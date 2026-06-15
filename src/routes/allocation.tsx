import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { operatives, properties, rates, fmtGBP } from "@/lib/data";

export const Route = createFileRoute("/allocation")({
  head: () => ({ meta: [{ title: "Daily Allocation — Schore" }] }),
  component: Allocation,
});

interface Line { id: string; group: string; task: string; qty: number; rate: number; isDay: boolean; split: boolean; housePct: number }

function Allocation() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [propertyId, setProperty] = useState(properties[0].id);
  const [operativeId, setOperative] = useState(operatives[0].id);
  const op = operatives.find(o => o.id === operativeId)!;
  const [lines, setLines] = useState<Line[]>([
    { id: crypto.randomUUID(), group: "KF", task: rates[0].id, qty: 1, rate: rates[0].rate, isDay: false, split: false, housePct: 100 },
  ]);
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines(l => [...l, { id: crypto.randomUUID(), group: "KF", task: rates[0].id, qty: 1, rate: rates[0].rate, isDay: false, split: false, housePct: 100 }]);
  const removeLine = (id: string) => setLines(l => l.filter(x => x.id !== id));
  const update = (id: string, patch: Partial<Line>) => setLines(l => l.map(x => x.id === id ? { ...x, ...patch } : x));
  const total = lines.reduce((s, l) => s + (l.isDay ? op.dailyRate : l.qty * l.rate), 0);

  const submit = async () => {
    if (lines.length === 0) return toast.error("Add at least one work line");
    setSaving(true);
    await new Promise(r => setTimeout(r, 700));
    setSaving(false);
    toast.success("Allocation saved", { description: `${lines.length} line(s) for ${op.name} · ${fmtGBP(total)}` });
  };

  return (
    <div>
      <PageHeader title="Daily Allocation" subtitle="Allocate price-work or day-rate lines to an operative on a property." />

      <div className="card-elevated p-6 mb-6">
        <h2 className="font-semibold mb-4">Property & Operative</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Date <span className="text-destructive">*</span></span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Property <span className="text-destructive">*</span></span>
            <select value={propertyId} onChange={e=>setProperty(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {properties.map(p => <option key={p.id} value={p.id}>{p.ref} ({p.contract})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Operative <span className="text-destructive">*</span></span>
            <select value={operativeId} onChange={e=>setOperative(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {operatives.filter(o=>o.status==="Active").map(o => <option key={o.id} value={o.id}>{o.name} — {o.trade}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Trade auto-loaded: <span className="font-medium text-foreground">{op.trade}</span> · Day rate {fmtGBP(op.dailyRate)}</p>
      </div>

      <div className="card-elevated p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Work lines</h2>
          <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4" />Add line</Button>
        </div>
        <div className="space-y-3">
          {lines.map((l, i) => {
            const r = rates.find(x => x.id === l.task);
            return (
              <div key={l.id} className="border rounded-lg p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <label className="md:col-span-2 block">
                  <span className="text-[11px] font-medium text-muted-foreground">Group</span>
                  <input value={l.group} onChange={e=>update(l.id,{group:e.target.value})} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </label>
                <label className="md:col-span-4 block">
                  <span className="text-[11px] font-medium text-muted-foreground">Task / Rate</span>
                  <select value={l.task} onChange={e=>{ const nr = rates.find(x=>x.id===e.target.value)!; update(l.id,{task:e.target.value, rate: nr.rate}); }} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {rates.map(r => <option key={r.id} value={r.id}>{r.code} — {r.task}</option>)}
                  </select>
                </label>
                <label className="md:col-span-1 block">
                  <span className="text-[11px] font-medium text-muted-foreground">Qty</span>
                  <input type="number" min={1} value={l.qty} onChange={e=>update(l.id,{qty:Number(e.target.value)})} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </label>
                <label className="md:col-span-2 block">
                  <span className="text-[11px] font-medium text-muted-foreground">Rate</span>
                  <input type="number" value={l.rate} onChange={e=>update(l.id,{rate:Number(e.target.value)})} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </label>
                <label className="md:col-span-2 flex items-center gap-2 pb-2">
                  <input type="checkbox" checked={l.isDay} onChange={e=>update(l.id,{isDay:e.target.checked})} />
                  <span className="text-xs">Day rate</span>
                </label>
                <div className="md:col-span-1 flex items-center justify-end pb-1">
                  <button onClick={()=>removeLine(l.id)} aria-label="Remove line" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="md:col-span-12 flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={l.split} onChange={e=>update(l.id,{split:e.target.checked})} />
                    Cost split required
                  </label>
                  {l.split && (
                    <label className="flex items-center gap-2">
                      House %:
                      <input type="number" min={0} max={100} value={l.housePct} onChange={e=>update(l.id,{housePct:Number(e.target.value)})} className="h-7 w-16 rounded border border-input bg-background px-2 text-xs" />
                    </label>
                  )}
                  <span className="ml-auto font-mono tabular-nums text-foreground">Line total: {fmtGBP(l.isDay ? op.dailyRate : l.qty * l.rate)}</span>
                </div>
              </div>
            );
          })}
          {lines.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No lines yet — add one.</div>}
        </div>
      </div>

      <div className="card-elevated p-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Allocation total</div>
          <div className="text-2xl font-display font-semibold font-mono">{fmtGBP(total)}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setLines([]); toast("Cleared"); }}>Clear</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save allocation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
