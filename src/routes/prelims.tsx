import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { operatives, fmtGBP } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal, Field, inputCls } from "@/components/Modal";

export const Route = createFileRoute("/prelims")({
  head: () => ({ meta: [{ title: "Prelims | Schore" }] }),
  component: Prelims,
});

interface Prelim { id: string; operativeId: string; role: string; dailyRate: number; contract: "MS" | "John"; status: "Active" | "Inactive" }

const seed: Prelim[] = [
  { id: "pr-1", operativeId: "op-007", role: "Storeman",        dailyRate: 180, contract: "MS",   status: "Active" },
  { id: "pr-2", operativeId: "op-008", role: "Driver",          dailyRate: 200, contract: "MS",   status: "Active" },
  { id: "pr-3", operativeId: "op-002", role: "Site Manager",    dailyRate: 280, contract: "MS",   status: "Active" },
  { id: "pr-4", operativeId: "op-001", role: "Project Manager", dailyRate: 320, contract: "MS",   status: "Active" },
  { id: "pr-5", operativeId: "op-004", role: "Site Manager",    dailyRate: 280, contract: "John", status: "Active" },
];

const ROLES = ["Storeman", "Driver", "Site Manager", "Project Manager"];
const blank: Prelim = { id: "", operativeId: operatives[0].id, role: ROLES[0], dailyRate: 200, contract: "MS", status: "Active" };

function Prelims() {
  const [rows, setRows] = useState(seed);
  const [editing, setEditing] = useState<Prelim | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Prelim>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const openNew = () => { setErr(""); setEditing(null); setCreating(true); setForm(blank); };
  const openEdit = (p: Prelim) => { setErr(""); setEditing(p); setCreating(false); setForm(p); };
  const close = () => { setEditing(null); setCreating(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.operativeId || !form.role) { setErr("Operative and role are required."); return; }
    if (form.dailyRate <= 0) { setErr("Daily rate must be greater than zero."); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    setRows(curr => editing
      ? curr.map(r => r.id === editing.id ? { ...form, id: editing.id } : r)
      : [{ ...form, id: crypto.randomUUID() }, ...curr]
    );
    setSaving(false);
    toast.success(editing ? "Prelim updated" : "Prelim added", { description: `${form.role} on ${form.contract} contract.` });
    close();
  };

  const modalOpen = creating || editing !== null;

  return (
    <div>
      <PageHeader
        title="Prelims Management"
        subtitle="Storeman, Driver, SM and PM — costed as a separate line per contract."
        actions={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4" />Add prelim</Button>}
      />

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Operative</th><th className="px-3 py-3 text-left">Role</th><th className="px-3 py-3 text-left">Contract</th><th className="px-3 py-3 text-right">Daily rate</th><th className="px-3 py-3 text-left">Status</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => {
              const o = operatives.find(x => x.id === r.operativeId);
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{o?.name}</td>
                  <td className="px-3 py-3">{r.role}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.contract}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(r.dailyRate)}</td>
                  <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3 text-right"><button aria-label={`Edit prelim ${o?.name}`} onClick={()=>openEdit(r)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={close} title={editing ? "Edit prelim" : "Add prelim assignment"} size="lg">
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{err}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Operative" required>
              <select required value={form.operativeId} onChange={e=>setForm(f=>({...f, operativeId:e.target.value}))} className={inputCls}>
                {operatives.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Role" required>
              <select required value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value}))} className={inputCls}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Contract" required>
              <select required value={form.contract} onChange={e=>setForm(f=>({...f, contract:e.target.value as "MS" | "John"}))} className={inputCls}>
                <option value="MS">MS</option><option value="John">John</option>
              </select>
            </Field>
            <Field label="Daily rate (£)" required>
              <input required type="number" min={0} step="0.01" value={form.dailyRate} onChange={e=>setForm(f=>({...f, dailyRate:Number(e.target.value)}))} className={inputCls} />
            </Field>
            <Field label="Status" required>
              <select value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value as Prelim["status"]}))} className={inputCls}>
                <option>Active</option><option>Inactive</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : (editing ? "Save changes" : "Add prelim")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
