import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { rates as seed, fmtGBP, type RateLine } from "@/lib/data";
import { Plus, Edit, Search, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Modal, Field, inputCls } from "@/components/Modal";
import { Can, useCan } from "@/components/Can";


export const Route = createFileRoute("/rates")({
  head: () => ({ meta: [{ title: "Rate Catalogue — Schore" }] }),
  component: Rates,
});

const PAY_TYPES: RateLine["payType"][] = ["Price", "Day"];

function Rates() {
  const canEdit = useCan("rates.edit");
  const [rows, setRows] = useState<RateLine[]>(seed);
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState("All");
  const [editing, setEditing] = useState<RateLine | null>(null);
  const [creating, setCreating] = useState<{ trade?: string } | null>(null);
  const [form, setForm] = useState<RateLine>({ id: "", trade: "", group: "", code: "", task: "", payType: "Price", rate: 0, unit: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");


  const trades = ["All", ...Array.from(new Set(rows.map(r => r.trade)))];

  const openNew = (presetTrade?: string) => {
    setErr("");
    setEditing(null);
    setCreating({ trade: presetTrade });
    setForm({ id: "", trade: presetTrade ?? "", group: "", code: "", task: "", payType: "Price", rate: 0, unit: "" });
  };
  const openEdit = (r: RateLine) => { setErr(""); setEditing(r); setCreating(null); setForm(r); };
  const close = () => { setEditing(null); setCreating(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.trade.trim() || !form.group.trim() || !form.code.trim() || !form.task.trim()) {
      setErr("Trade, group, code and task are required."); return;
    }
    if (form.rate <= 0) { setErr("Rate must be greater than zero."); return; }
    if (!editing && rows.some(r => r.code.toLowerCase() === form.code.trim().toLowerCase() && r.trade === form.trade)) {
      setErr("A rate with that code already exists for this trade."); return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 450));
    setRows(curr => editing ? curr.map(r => r.id === editing.id ? { ...form, id: editing.id } : r) : [...curr, { ...form, id: `r-${Date.now()}` }]);
    setSaving(false);
    toast.success(editing ? `Rate updated — ${form.code}` : `Rate added — ${form.code}`);
    close();
  };

  const filtered = rows.filter(r =>
    (trade === "All" || r.trade === trade) &&
    (!q || r.task.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase()))
  );

  const groups: Record<string, Record<string, RateLine[]>> = {};
  filtered.forEach(r => {
    groups[r.trade] = groups[r.trade] || {};
    groups[r.trade][r.group] = groups[r.trade][r.group] || [];
    groups[r.trade][r.group].push(r);
  });

  const modalOpen = creating !== null || editing !== null;

  return (
    <div>
      <PageHeader
        title="Rate Catalogue"
        subtitle={canEdit ? "CEO / CM / PM can edit · SM can view but not edit" : "View-only — your role cannot modify rates"}
        actions={
          <Can permission="rates.edit" fallback={<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> View-only</span>}>
            <Button size="sm" onClick={() => openNew()}><Plus className="h-4 w-4" />New rate</Button>
          </Can>
        }
      />


      <div className="card-elevated mb-6">
        <div className="p-4 flex flex-wrap gap-3 border-b">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-72">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search task or code…" className="bg-transparent text-sm outline-none w-full" />
          </div>
          <select value={trade} onChange={e=>setTrade(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {trades.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groups).map(([tradeName, gs]) => (
          <div key={tradeName} className="card-elevated">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="font-display font-semibold">{tradeName}</h2>
                <p className="text-xs text-muted-foreground">{Object.values(gs).flat().length} tasks across {Object.keys(gs).length} groups</p>
              </div>
              <Can permission="rates.edit">
                <Button variant="outline" size="sm" onClick={() => openNew(tradeName)}><Plus className="h-4 w-4" />Add task</Button>
              </Can>
            </div>

            {Object.entries(gs).map(([groupName, items]) => (
              <div key={groupName} className="border-b last:border-0">
                <div className="px-5 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">{groupName}</div>
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {items.map(r => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3 w-20"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{r.code}</code></td>
                        <td className="px-3 py-3">{r.task}</td>
                        <td className="px-3 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${r.payType === "Price" ? "bg-info/10 text-info" : "bg-accent/15 text-accent-foreground"}`}>{r.payType}</span></td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(r.rate)}{r.unit && <span className="text-xs text-muted-foreground ml-1">{r.unit}</span>}</td>
                        <td className="px-5 py-3 text-right">
                          <button type="button" aria-label={`Edit ${r.task}`} onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <div className="text-sm font-medium">No rates match your search</div>
            <p className="text-xs text-muted-foreground mt-1">The firm owns this catalogue. Add a rate to extend the engine.</p>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={close} title={editing ? `Edit rate — ${editing.code}` : "New rate"} size="lg">
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{err}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Trade" required>
              <input required value={form.trade} onChange={e=>setForm(f=>({...f, trade:e.target.value}))} className={inputCls} placeholder="Carpenter" list="trade-options" />
              <datalist id="trade-options">{Array.from(new Set(rows.map(r=>r.trade))).map(t => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="Group" required>
              <input required value={form.group} onChange={e=>setForm(f=>({...f, group:e.target.value}))} className={inputCls} placeholder="e.g. KF, Doors" />
            </Field>
            <Field label="Code" required>
              <input required value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className={inputCls} disabled={!!editing} />
            </Field>
            <Field label="Task" required>
              <input required value={form.task} onChange={e=>setForm(f=>({...f, task:e.target.value}))} className={inputCls} />
            </Field>
            <Field label="Pay type" required>
              <select value={form.payType} onChange={e=>setForm(f=>({...f, payType:e.target.value as RateLine["payType"]}))} className={inputCls}>
                {PAY_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Rate (£)" required>
              <input required type="number" min={0} step="0.01" value={form.rate} onChange={e=>setForm(f=>({...f, rate:Number(e.target.value)}))} className={inputCls} />
            </Field>
            <Field label="Unit (optional)">
              <input value={form.unit ?? ""} onChange={e=>setForm(f=>({...f, unit:e.target.value}))} className={inputCls} placeholder="per door / per m²" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : (editing ? "Save changes" : "Create rate")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
