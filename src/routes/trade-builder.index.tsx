import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal, Field, inputCls } from "@/components/Modal";

export const Route = createFileRoute("/trade-builder/")({ component: Trades });

interface Trade { name: string; groups: number; tasks: number; status: string }

const seed: Trade[] = [
  { name: "Carpenter",   groups: 4, tasks: 18, status: "Active" },
  { name: "Plumber",     groups: 3, tasks: 11, status: "Active" },
  { name: "Electrician", groups: 3, tasks: 9,  status: "Active" },
  { name: "Tiler",       groups: 2, tasks: 6,  status: "Active" },
  { name: "Labourer",    groups: 2, tasks: 5,  status: "Active" },
  { name: "Painter",     groups: 2, tasks: 7,  status: "Active" },
  { name: "Plasterer",   groups: 1, tasks: 3,  status: "Inactive" },
];

function Trades() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(seed);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Trade>({ name: "", groups: 0, tasks: 0, status: "Active" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const open = (t: Trade | null) => {
    setErr("");
    if (t) { setEditing(t); setForm(t); }
    else { setEditing(null); setCreating(true); setForm({ name: "", groups: 0, tasks: 0, status: "Active" }); }
  };
  const close = () => { setEditing(null); setCreating(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Trade name is required."); return; }
    if (!editing && rows.some(r => r.name.toLowerCase() === form.name.trim().toLowerCase())) {
      setErr("A trade with that name already exists."); return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 450));
    setRows(curr => editing ? curr.map(r => r.name === editing.name ? form : r) : [{ ...form }, ...curr]);
    setSaving(false);
    toast.success(editing ? `Trade updated — ${form.name}` : `Trade created — ${form.name}`);
    close();
  };

  const rowsFiltered = rows.filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const modalOpen = creating || editing !== null;

  return (
    <div>
      <div className="card-elevated mb-4 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search trade…" className="bg-transparent text-sm outline-none w-full" />
        </div>
        <Button size="sm" className="ml-auto" onClick={() => open(null)}><Plus className="h-4 w-4" />New trade</Button>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Trade</th><th className="px-3 py-3 text-right">Groups</th><th className="px-3 py-3 text-right">Tasks</th><th className="px-3 py-3 text-left">Status</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {rowsFiltered.map(r => (
              <tr key={r.name} className="hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{r.groups}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{r.tasks}</td>
                <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-5 py-3 text-right"><button aria-label={`Edit ${r.name}`} onClick={() => open(r)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rowsFiltered.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No trades match your search.</div>}
      </div>

      <Modal open={modalOpen} onClose={close} title={editing ? `Edit trade — ${editing.name}` : "New trade"} subtitle="CEO / CM only">
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{err}</div>}
          <Field label="Trade name" required>
            <input required autoFocus value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} className={inputCls} placeholder="e.g. Carpenter" />
          </Field>
          <Field label="Status" required>
            <select value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value}))} className={inputCls}>
              <option>Active</option><option>Inactive</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : (editing ? "Save changes" : "Create trade")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
