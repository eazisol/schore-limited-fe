import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { getProperty, allocations, getOperative, fmtGBP, holdReasons } from "@/lib/data";
import { propertiesStore, useProperty } from "@/lib/properties-store";
import { Modal, Field, inputCls } from "@/components/Modal";
import { ArrowLeft, MapPin, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["KBWC", "Bathroom", "Kitchen", "Wet Room"] as const;
const STATUSES = ["In Progress", "Handed Over", "On Hold", "Snag"] as const;

export const Route = createFileRoute("/properties/$id")({
  loader: ({ params }) => {
    const p = getProperty(params.id) ?? propertiesStore.get().find(x => x.id === params.id);
    if (!p) throw notFound();
    return { id: params.id };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `Property ${loaderData?.id ?? ""} | Schore` }] }),
  notFoundComponent: () => (
    <div className="card-elevated p-12 text-center">
      <h2 className="font-display font-semibold">Property not found</h2>
      <Button className="mt-4" asChild><Link to="/properties">All properties</Link></Button>
    </div>
  ),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { id } = Route.useLoaderData();
  const p = useProperty(id);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(() => ({
    ref: p?.ref ?? "", address: p?.address ?? "", postcode: p?.postcode ?? "",
    contract: p?.contract ?? "MS", type: p?.type ?? TYPES[0], status: p?.status ?? STATUSES[0],
    startDate: p?.startDate ?? "", budget: p?.budget ?? 0, siteManager: p?.siteManager ?? "",
    accessNotes: p?.accessNotes ?? "",
  }));

  if (!p) return null;
  const allocs = allocations.filter(a => a.propertyId === p.id);
  const pct = Math.round(p.spent / p.budget * 100);
  const remaining = p.budget - p.spent;
  const kpiDays = p.daysOnSite - p.heldDays;
  const kpiTarget = p.type === "KBWC" ? 15 : p.type === "Kitchen" ? 11 : 9;

  const openEdit = () => {
    setErr("");
    setForm({
      ref: p.ref, address: p.address, postcode: p.postcode, contract: p.contract,
      type: p.type, status: p.status, startDate: p.startDate, budget: p.budget,
      siteManager: p.siteManager, accessNotes: p.accessNotes ?? "",
    });
    setEditOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ref.trim() || !form.address.trim() || !form.postcode.trim()) { setErr("Reference, address and postcode are required."); return; }
    if (form.budget <= 0) { setErr("Budget must be greater than zero."); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    propertiesStore.update(p.id, form);
    setSaving(false);
    setEditOpen(false);
    toast.success("Property updated", { description: `${form.ref} saved.` });
  };



  return (
    <div className="space-y-6">
      <Link to="/properties" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All properties
      </Link>

      <PageHeader
        title={p.ref}
        subtitle={`${p.address} · ${p.postcode}`}
        actions={
          <>
            <StatusBadge status={p.status} />
            <Button variant="outline" size="sm" onClick={openEdit}>Edit property</Button>
            <Button size="sm" onClick={() => { propertiesStore.update(p.id, { status: "Handed Over" }); toast.success(`${p.ref} handed over`, { description: "Property marked complete and KPI clock stopped." }); }}>Hand over</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Mini label="Contract" value={p.contract} />
            <Mini label="Type" value={p.type} />
            <Mini label="Days on site" value={`${p.daysOnSite}`} hint={`${p.heldDays} held`} />
            <Mini label="KPI clock" value={`${kpiDays}/${kpiTarget}`} hint={kpiDays > kpiTarget ? "Over target" : "On target"} tone={kpiDays > kpiTarget ? "warn" : "ok"} />
          </div>

          {/* Budget */}
          <div className="card-elevated p-6">
            <div className="flex justify-between items-baseline mb-3">
              <h3 className="font-display font-semibold">Cost vs Budget</h3>
              <span className={`text-xs ${pct > 90 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {pct}% spent · {fmtGBP(remaining)} remaining
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : "bg-accent"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Spent</div><div className="font-mono tabular-nums">{fmtGBP(p.spent)}</div></div>
              <div><div className="text-xs text-muted-foreground">Budget</div><div className="font-mono tabular-nums">{fmtGBP(p.budget)}</div></div>
              <div><div className="text-xs text-muted-foreground">Remaining</div><div className={`font-mono tabular-nums ${remaining < 0 ? "text-destructive" : ""}`}>{fmtGBP(remaining)}</div></div>
            </div>
            {pct > 90 && (
              <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex gap-2 text-xs">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <span>This property is approaching budget. Review allocations before further work.</span>
              </div>
            )}
          </div>

          {/* Allocations */}
          <div className="card-elevated">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold">Work history</h3>
              <p className="text-xs text-muted-foreground">All ticked work on this property — feeds wage sheets.</p>
            </div>
            {allocs.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No allocations recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-5 py-2.5">Date</th>
                    <th className="text-left font-medium px-3 py-2.5">Operative</th>
                    <th className="text-left font-medium px-3 py-2.5">Task</th>
                    <th className="text-right font-medium px-5 py-2.5">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allocs.map(a => {
                    const op = getOperative(a.operativeId);
                    return (
                      <tr key={a.id}>
                        <td className="px-5 py-3">{a.date}</td>
                        <td className="px-3 py-3">{op?.name}</td>
                        <td className="px-3 py-3">{a.description} <code className="text-[10px] font-mono ml-1 text-muted-foreground">{a.code}</code></td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">{fmtGBP(a.value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-elevated p-6">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" /> Access</h3>
            <p className="text-sm">{p.accessNotes || <span className="text-muted-foreground">No access notes.</span>}</p>
            <div className="mt-4 text-xs text-muted-foreground">Site Manager</div>
            <div className="text-sm font-medium">{p.siteManager}</div>
          </div>

          {p.status === "On Hold" && (
            <div className="card-elevated p-6 border-warning/30">
              <h3 className="font-display font-semibold mb-2">Hold reason</h3>
              <p className="text-sm">{holdReasons[1]}</p>
              <p className="text-xs text-muted-foreground mt-2">Day not counted toward KPI · timestamped for delay claim</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => toast.success(`Hold lifted on ${p.ref}`, { description: "KPI clock resumed." })}>Lift hold</Button>
            </div>
          )}
        </div>
      </div>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title={`Edit property — ${p.ref}`} size="lg">
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{err}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Reference" required>
              <input required value={form.ref} onChange={e=>setForm(f=>({...f, ref:e.target.value}))} className={inputCls} />
            </Field>
            <Field label="Postcode" required>
              <input required value={form.postcode} onChange={e=>setForm(f=>({...f, postcode:e.target.value.toUpperCase()}))} className={inputCls} />
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
              <input value={form.accessNotes} onChange={e=>setForm(f=>({...f, accessNotes:e.target.value}))} className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save changes"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Mini({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="card-elevated p-4">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-display font-semibold mt-1">{value}</div>
      {hint && <div className={`text-[11px] mt-0.5 ${tone === "warn" ? "text-destructive" : "text-muted-foreground"}`}>{hint}</div>}
    </div>
  );
}
