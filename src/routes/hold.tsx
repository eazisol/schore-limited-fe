import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, OctagonPause } from "lucide-react";
import { toast } from "sonner";
import { properties, holdReasons } from "@/lib/data";
import { useSession } from "@/lib/session-store";

export const Route = createFileRoute("/hold")({
  head: () => ({ meta: [{ title: "Hold Management — Schore" }] }),
  component: Hold,
});

interface HoldEntry { id: string; propertyId: string; date: string; reason: string; notes: string; addedBy: string }

const initial: HoldEntry[] = [
  { id: "h-1", propertyId: "p-104", date: "2026-01-21", reason: "Wet walls — drying", notes: "Dryers in place", addedBy: "Florin Vasile" },
  { id: "h-2", propertyId: "p-107", date: "2026-01-18", reason: "Asbestos not removed in time", notes: "Awaiting contractor", addedBy: "Florin Vasile" },
];

function Hold() {
  const session = useSession();
  const [entries, setEntries] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ propertyId: properties[0].id, date: new Date().toISOString().slice(0,10), reason: holdReasons[0], notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setEntries(es => [{ id: crypto.randomUUID(), ...form, addedBy: session.name }, ...es]);
    setSaving(false);
    setOpen(false);
    toast.success("Hold added", { description: "KPI clock paused for this property." });
  };

  return (
    <div>
      <PageHeader
        title="Hold / No Count Management"
        subtitle="Pause the KPI clock when work can't progress."
        actions={<Button size="sm" onClick={() => setOpen(o => !o)}><Plus className="h-4 w-4" />New hold</Button>}
      />

      {open && (
        <form onSubmit={submit} className="card-elevated p-6 mb-6 space-y-4">
          <h2 className="font-semibold">Add hold</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Property <span className="text-destructive">*</span></span>
              <select required value={form.propertyId} onChange={e=>setForm(f=>({...f, propertyId:e.target.value}))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                {properties.map(p => <option key={p.id} value={p.id}>{p.ref}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Date <span className="text-destructive">*</span></span>
              <input required type="date" value={form.date} onChange={e=>setForm(f=>({...f, date:e.target.value}))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Hold reason <span className="text-destructive">*</span></span>
              <select required value={form.reason} onChange={e=>setForm(f=>({...f, reason:e.target.value}))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                {holdReasons.map(r => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <input value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))} placeholder="Optional context" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Add hold"}</Button>
          </div>
        </form>
      )}

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Property</th><th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Reason</th><th className="px-3 py-3 text-left">Notes</th><th className="px-3 py-3 text-left">Added by</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {entries.map(e => {
              const p = properties.find(x => x.id === e.propertyId);
              return (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium flex items-center gap-2"><OctagonPause className="h-4 w-4 text-warning" />{p?.ref}</td>
                  <td className="px-3 py-3 text-muted-foreground">{e.date}</td>
                  <td className="px-3 py-3">{e.reason}</td>
                  <td className="px-3 py-3 text-muted-foreground">{e.notes || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{e.addedBy}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={()=>{ setEntries(es=>es.filter(x=>x.id!==e.id)); toast("Hold released"); }} className="text-xs text-info hover:underline">Release</button>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">No holds — every property is progressing.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-6 card-elevated p-5">
        <h3 className="font-semibold mb-2">Hold reasons</h3>
        <div className="flex flex-wrap gap-2">
          {holdReasons.map(r => <span key={r} className="text-xs px-2.5 py-1 rounded-full bg-secondary">{r}</span>)}
        </div>
      </div>
    </div>
  );
}
