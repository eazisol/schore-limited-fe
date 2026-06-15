import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal, Field, inputCls } from "@/components/Modal";

export const Route = createFileRoute("/trade-builder/groups")({ component: Groups });

interface Group { code: string; name: string; trade: string; order: number; status: string }

const seed: Group[] = [
  { code: "KF",  name: "Kitchen Fit",   trade: "Carpenter",   order: 1, status: "Active" },
  { code: "C1",  name: "Carcass 1",     trade: "Carpenter",   order: 2, status: "Active" },
  { code: "C2",  name: "Carcass 2",     trade: "Carpenter",   order: 3, status: "Active" },
  { code: "C3",  name: "Carcass 3",     trade: "Carpenter",   order: 4, status: "Active" },
  { code: "DW",  name: "Day Work",      trade: "All",         order: 5, status: "Active" },
  { code: "EW",  name: "Extra Work",    trade: "All",         order: 6, status: "Active" },
  { code: "T-W", name: "Wall Tiling",   trade: "Tiler",       order: 1, status: "Active" },
  { code: "Pl1", name: "1st Fix Plumb", trade: "Plumber",     order: 1, status: "Active" },
];

const TRADES = ["Carpenter", "Plumber", "Electrician", "Tiler", "Labourer", "Painter", "Plasterer", "All"];

function Groups() {
  const [rows, setRows] = useState(seed);
  const [editing, setEditing] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Group>({ code: "", name: "", trade: TRADES[0], order: 1, status: "Active" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const open = (g: Group | null) => {
    setErr("");
    if (g) { setEditing(g); setForm(g); }
    else { setEditing(null); setCreating(true); setForm({ code: "", name: "", trade: TRADES[0], order: rows.length + 1, status: "Active" }); }
  };
  const close = () => { setEditing(null); setCreating(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setErr("Code and name are required."); return; }
    if (!editing && rows.some(r => r.code.toLowerCase() === form.code.trim().toLowerCase())) {
      setErr("A group with that code already exists."); return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 450));
    setRows(curr => editing ? curr.map(r => r.code === editing.code ? form : r) : [...curr, form]);
    setSaving(false);
    toast.success(editing ? `Group updated — ${form.code}` : `Group created — ${form.code}`);
    close();
  };

  const modalOpen = creating || editing !== null;

  return (
    <div>
      <div className="card-elevated mb-4 p-4 flex justify-end">
        <Button size="sm" onClick={() => open(null)}><Plus className="h-4 w-4" />New group</Button>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Code</th><th className="px-3 py-3 text-left">Name</th><th className="px-3 py-3 text-left">Trade</th><th className="px-3 py-3 text-right">Order</th><th className="px-3 py-3 text-left">Status</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(g => (
              <tr key={g.code} className="hover:bg-muted/30">
                <td className="px-5 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{g.code}</code></td>
                <td className="px-3 py-3 font-medium">{g.name}</td>
                <td className="px-3 py-3 text-muted-foreground">{g.trade}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{g.order}</td>
                <td className="px-3 py-3"><StatusBadge status={g.status} /></td>
                <td className="px-5 py-3 text-right"><button aria-label={`Edit ${g.code}`} onClick={() => open(g)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={close} title={editing ? `Edit group — ${editing.code}` : "New group"}>
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{err}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Code" required hint="Short code like KF, C1, DW">
              <input required value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className={inputCls} disabled={!!editing} />
            </Field>
            <Field label="Name" required>
              <input required value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} className={inputCls} />
            </Field>
            <Field label="Trade" required>
              <select value={form.trade} onChange={e=>setForm(f=>({...f, trade:e.target.value}))} className={inputCls}>
                {TRADES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Display order" required>
              <input required type="number" min={1} value={form.order} onChange={e=>setForm(f=>({...f, order:Number(e.target.value)}))} className={inputCls} />
            </Field>
            <Field label="Status" required>
              <select value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value}))} className={inputCls}>
                <option>Active</option><option>Inactive</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : (editing ? "Save changes" : "Create group")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
