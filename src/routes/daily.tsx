import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/Modal";
import { properties, operatives, allocations, getOperative, getProperty, fmtGBP, rates } from "@/lib/data";
import { Lock, CheckCircle2, ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/daily")({
  head: () => ({ meta: [{ title: "Daily Programme — Schore" }] }),
  component: Daily,
});

function Daily() {
  const [date, setDate] = useState("2026-01-23");
  const [showHO, setShowHO] = useState(false);
  const [confirmRoll, setConfirmRoll] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocSaving, setAllocSaving] = useState(false);
  const [allocForm, setAllocForm] = useState({ operativeId: operatives[0].id, propertyId: properties[0].id, code: rates[0]?.code ?? "", qty: 1, notes: "" });

  const submitAlloc = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllocSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setAllocSaving(false);
    setAllocOpen(false);
    const op = getOperative(allocForm.operativeId);
    const pr = getProperty(allocForm.propertyId);
    toast.success("Allocation created", { description: `${op?.name} → ${pr?.ref} · ${allocForm.code} × ${allocForm.qty}` });
  };

  const visible = properties.filter(p => showHO || p.status !== "Handed Over");
  const todayAllocs = allocations.filter(a => a.date === date);
  const allTicked = todayAllocs.every(a => a.status === "Ticked" || a.status === "Locked");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Programme"
        subtitle="Auto-generated from the Master · carry-forward replaces copy-tab"
        actions={
          <>
            <div className="flex items-center gap-1 border border-input rounded-md bg-card">
              <button className="h-9 w-9 grid place-items-center hover:bg-accent/10"><ChevronLeft className="h-4 w-4" /></button>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="h-9 px-2 bg-transparent text-sm border-x border-input outline-none" />
              <button className="h-9 w-9 grid place-items-center hover:bg-accent/10"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <Button size="sm" onClick={() => setConfirmRoll(true)} disabled={!allTicked}>
              {allTicked ? "Roll forward to next day" : "Tick all to roll forward"}
            </Button>
          </>
        }
      />

      {!allTicked && (
        <div className="card-elevated p-4 border-warning/30 bg-warning/5 flex gap-3 items-start">
          <Lock className="h-4 w-4 text-warning-foreground mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">The Lock is active</div>
            <div className="text-xs text-muted-foreground mt-0.5">SM cannot allocate the next step on a property until yesterday's work is ticked or confirmed.</div>
          </div>
        </div>
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Counter label="In Progress" value={properties.filter(p => p.status === "In Progress").length} tone="info" />
        <Counter label="On Hold" value={properties.filter(p => p.status === "On Hold").length} tone="warn" />
        <Counter label="Snags" value={properties.filter(p => p.status === "Snag").length} tone="destructive" />
        <Counter label="Operatives on Site" value={new Set(todayAllocs.map(a => a.operativeId)).size} tone="ok" />
      </div>

      <div className="card-elevated">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold">Roll for {new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
            <p className="text-xs text-muted-foreground">{visible.length} properties on roll · {todayAllocs.length} allocations</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showHO} onChange={e=>setShowHO(e.target.checked)} className="rounded" />
              Show handed-over
            </label>
            <Button size="sm" variant="outline" onClick={() => setAllocOpen(true)}><Plus className="h-4 w-4" />Allocate</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-2.5 w-10">#</th>
                <th className="text-left font-medium px-3 py-2.5">Property</th>
                <th className="text-left font-medium px-3 py-2.5">Contract</th>
                <th className="text-left font-medium px-3 py-2.5">Type</th>
                <th className="text-left font-medium px-3 py-2.5">Today's operative</th>
                <th className="text-left font-medium px-3 py-2.5">Code</th>
                <th className="text-left font-medium px-3 py-2.5">Time</th>
                <th className="text-left font-medium px-3 py-2.5">Next Day (suggested)</th>
                <th className="text-left font-medium px-5 py-2.5">Lock</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((p, i) => {
                const a = todayAllocs.find(x => x.propertyId === p.id);
                const op = a ? getOperative(a.operativeId) : undefined;
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{i+1}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{p.ref}</div>
                      <div className="text-[11px] text-muted-foreground">{p.postcode}{p.accessNotes ? ` · ${p.accessNotes}` : ""}</div>
                    </td>
                    <td className="px-3 py-3"><code className="text-xs font-mono">{p.contract}</code></td>
                    <td className="px-3 py-3 text-muted-foreground">{p.type}</td>
                    <td className="px-3 py-3">
                      {op ? <><span className="font-medium">{op.name}</span><div className="text-[11px] text-muted-foreground">{op.trade}</div></> : <span className="text-muted-foreground italic">No allocation</span>}
                    </td>
                    <td className="px-3 py-3">{a && <code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{a.code}</code>}</td>
                    <td className="px-3 py-3 text-muted-foreground">{a?.time}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {p.type === "KBWC" ? "T / D / V" : p.type === "Kitchen" ? "V / HM" : "Pl / E / HM"}
                    </td>
                    <td className="px-5 py-3">
                      {a?.status === "Ticked" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 className="h-3.5 w-3.5" />Ticked</span>
                      ) : a?.status === "Locked" ? (
                        <StatusBadge status="On Hold" />
                      ) : a ? (
                        <button className="text-xs font-medium text-info hover:underline" onClick={() => toast.success("Allocation ticked")}>Tick</button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No properties on today's roll.</div>}
        </div>
      </div>

      {confirmRoll && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full p-6 border">
            <h3 className="font-display font-semibold text-lg">Roll forward to next day?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              All in-progress properties will carry forward automatically. Handed-over properties drop off. The next day's allocations will be opened for the SM to plan.
            </p>
            <div className="mt-4 p-3 rounded-md bg-secondary text-xs space-y-1">
              <div><span className="text-muted-foreground">Properties carrying forward:</span> <strong>{properties.filter(p=>p.status==="In Progress").length}</strong></div>
              <div><span className="text-muted-foreground">Dropping off (Handed Over):</span> <strong>{properties.filter(p=>p.status==="Handed Over").length}</strong></div>
              <div><span className="text-muted-foreground">Open holds (KPI paused):</span> <strong>{properties.filter(p=>p.status==="On Hold").length}</strong></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={()=>setConfirmRoll(false)}>Cancel</Button>
              <Button onClick={() => { toast.success("Rolled forward to 24/01/2026"); setConfirmRoll(false); }}>Confirm roll</Button>
            </div>
          </div>
        </div>
      )}

      <Modal open={allocOpen} onClose={()=>setAllocOpen(false)} title="New allocation" subtitle="Assign an operative to a property for this day.">
        <form onSubmit={submitAlloc} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Operative" required>
              <select required value={allocForm.operativeId} onChange={e=>setAllocForm(f=>({...f, operativeId:e.target.value}))} className={inputCls}>
                {operatives.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Property" required>
              <select required value={allocForm.propertyId} onChange={e=>setAllocForm(f=>({...f, propertyId:e.target.value}))} className={inputCls}>
                {properties.map(p => <option key={p.id} value={p.id}>{p.ref} · {p.postcode}</option>)}
              </select>
            </Field>
            <Field label="Task code" required>
              <select required value={allocForm.code} onChange={e=>setAllocForm(f=>({...f, code:e.target.value}))} className={inputCls}>
                {rates.map(r => <option key={r.id} value={r.code}>{r.code} — {r.task}</option>)}
              </select>
            </Field>
            <Field label="Quantity" required>
              <input required type="number" min={0.5} step={0.5} value={allocForm.qty} onChange={e=>setAllocForm(f=>({...f, qty:Number(e.target.value)}))} className={inputCls} />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea value={allocForm.notes} onChange={e=>setAllocForm(f=>({...f, notes:e.target.value}))} className={`${inputCls} h-20 py-2`} placeholder="Access, materials, hand-over notes…" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={()=>setAllocOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={allocSaving}>{allocSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Allocating…</> : "Allocate"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "info" | "warn" | "destructive" | "ok" }) {
  const colors = {
    info: "text-info",
    warn: "text-warning-foreground",
    destructive: "text-destructive",
    ok: "text-success",
  };
  return (
    <div className="card-elevated p-4">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-display font-semibold mt-1 ${colors[tone]}`}>{value}</div>
    </div>
  );
}
