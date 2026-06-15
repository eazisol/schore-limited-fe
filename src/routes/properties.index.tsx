import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { fmtGBP } from "@/lib/data";
import { propertiesStore, useProperties } from "@/lib/properties-store";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Modal, Field, inputCls } from "@/components/Modal";

export const Route = createFileRoute("/properties/")({
  head: () => ({ meta: [{ title: "Properties — Schore" }] }),
  component: PropertiesList,
});

const TYPES = ["KBWC", "Bathroom", "Kitchen", "Wet Room"] as const;
const STATUSES = ["In Progress", "Handed Over", "On Hold", "Snag"] as const;

function PropertiesList() {
  const all = useProperties();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [contract, setContract] = useState("All");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    ref: "", address: "", postcode: "", contract: "MS" as "MS" | "John",
    type: TYPES[0] as (typeof TYPES)[number],
    status: "In Progress" as (typeof STATUSES)[number],
    startDate: new Date().toISOString().slice(0, 10),
    budget: 5600, siteManager: "Claudiu Ceausu", accessNotes: "",
  });

  const rows = useMemo(() => all.filter(p => {
    if (q && !p.address.toLowerCase().includes(q.toLowerCase()) && !p.postcode.toLowerCase().includes(q.toLowerCase()) && !p.ref.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "All" && p.status !== status) return false;
    if (contract !== "All" && p.contract !== contract) return false;
    return true;
  }), [all, q, status, contract]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!form.ref.trim() || !form.address.trim() || !form.postcode.trim()) {
      setErr("Reference, address and postcode are required."); return;
    }
    if (form.budget <= 0) { setErr("Budget must be greater than zero."); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    propertiesStore.create(form);
    setSaving(false);
    setOpen(false);
    toast.success("Property added", { description: `${form.ref} · ${form.postcode}` });
  };

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={`${rows.length} properties · KPI clock pauses on held days`}
        actions={<Button size="sm" onClick={() => { setErr(""); setOpen(true); }}><Plus className="h-4 w-4" />Add property</Button>}
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

      <Modal open={open} onClose={()=>setOpen(false)} title="Add property" subtitle="Connect to a contract to enable allocation." size="lg">
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{err}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Reference" required hint="Short identifier like '30 Wimbourne'">
              <input required value={form.ref} onChange={e=>setForm(f=>({...f, ref:e.target.value}))} className={inputCls} />
            </Field>
            <Field label="Postcode" required>
              <input required value={form.postcode} onChange={e=>setForm(f=>({...f, postcode:e.target.value.toUpperCase()}))} className={inputCls} placeholder="SS14 1AA" />
            </Field>
            <Field label="Address" required>
              <input required value={form.address} onChange={e=>setForm(f=>({...f, address:e.target.value}))} className={inputCls} />
            </Field>
            <Field label="Contract" required>
              <select value={form.contract} onChange={e=>setForm(f=>({...f, contract:e.target.value as "MS" | "John"}))} className={inputCls}>
                <option value="MS">MS</option><option value="John">John</option>
              </select>
            </Field>
            <Field label="Type" required>
              <select value={form.type} onChange={e=>setForm(f=>({...f, type:e.target.value as (typeof TYPES)[number]}))} className={inputCls}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status" required>
              <select value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value as (typeof STATUSES)[number]}))} className={inputCls}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Start date" required>
              <input required type="date" value={form.startDate} onChange={e=>setForm(f=>({...f, startDate:e.target.value}))} className={inputCls} />
            </Field>
            <Field label="Budget (£)" required>
              <input required type="number" min={0} step="100" value={form.budget} onChange={e=>setForm(f=>({...f, budget:Number(e.target.value)}))} className={inputCls} />
            </Field>
            <Field label="Site Manager" required>
              <input required value={form.siteManager} onChange={e=>setForm(f=>({...f, siteManager:e.target.value}))} className={inputCls} />
            </Field>
            <Field label="Access notes (optional)">
              <input value={form.accessNotes} onChange={e=>setForm(f=>({...f, accessNotes:e.target.value}))} className={inputCls} placeholder="Key in office, garden access…" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Add property"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
