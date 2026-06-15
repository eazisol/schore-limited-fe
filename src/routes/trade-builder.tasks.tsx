import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal, Field, inputCls } from "@/components/Modal";
import { fmtGBP } from "@/lib/data";

export const Route = createFileRoute("/trade-builder/tasks")({ component: Tasks });

interface Task { code: string; name: string; trade: string; group: string; unit: string; rate: number; status: string; flags: string[] }

const seed: Task[] = [
  { code: "FD",   name: "Fire Door",       trade: "Carpenter",   group: "Doors",   unit: "per door",  rate: 90,  status: "Active", flags: ["Tick"] },
  { code: "PF",   name: "Ply Door",        trade: "Carpenter",   group: "Doors",   unit: "per door",  rate: 70,  status: "Active", flags: ["Tick"] },
  { code: "BX",   name: "Box In",          trade: "Carpenter",   group: "Extra",   unit: "per job",   rate: 60,  status: "Active", flags: ["Extra"] },
  { code: "SW",   name: "Stud Wall",       trade: "Carpenter",   group: "Walls",   unit: "per m²",    rate: 38,  status: "Active", flags: ["Measured"] },
  { code: "PW",   name: "Partition Wall",  trade: "Carpenter",   group: "Walls",   unit: "per m²",    rate: 42,  status: "Active", flags: ["Measured"] },
  { code: "PB",   name: "Plasterboard",    trade: "Plasterer",   group: "Skim",    unit: "per board", rate: 22,  status: "Active", flags: ["Measured"] },
  { code: "KF",   name: "Kitchen Fit",     trade: "Carpenter",   group: "KF",      unit: "per item",  rate: 240, status: "Active", flags: ["Package"] },
];

const TRADES = ["Carpenter", "Plumber", "Electrician", "Tiler", "Labourer", "Painter", "Plasterer"];
const FLAGS = ["Tick", "Extra", "Measured", "Package"];

function Tasks() {
  const [rows, setRows] = useState(seed);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Task>({ code: "", name: "", trade: TRADES[0], group: "", unit: "per item", rate: 0, status: "Active", flags: [] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const open = (t: Task | null) => {
    setErr("");
    if (t) { setEditing(t); setForm(t); }
    else { setEditing(null); setCreating(true); setForm({ code: "", name: "", trade: TRADES[0], group: "", unit: "per item", rate: 0, status: "Active", flags: [] }); }
  };
  const close = () => { setEditing(null); setCreating(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setErr("Code and name are required."); return; }
    if (form.rate <= 0) { setErr("Rate must be greater than zero."); return; }
    if (!editing && rows.some(r => r.code.toLowerCase() === form.code.trim().toLowerCase())) {
      setErr("A task with that code already exists."); return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 450));
    setRows(curr => editing ? curr.map(r => r.code === editing.code ? form : r) : [...curr, form]);
    setSaving(false);
    toast.success(editing ? `Task updated — ${form.code}` : `Task created — ${form.code}`);
    close();
  };

  const toggleFlag = (f: string) => setForm(s => ({ ...s, flags: s.flags.includes(f) ? s.flags.filter(x => x !== f) : [...s.flags, f] }));
  const modalOpen = creating || editing !== null;

  return (
    <div>
      <div className="card-elevated mb-4 p-4 flex justify-end">
        <Button size="sm" onClick={() => open(null)}><Plus className="h-4 w-4" />New task</Button>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Code</th><th className="px-3 py-3 text-left">Task</th><th className="px-3 py-3 text-left">Trade</th>
              <th className="px-3 py-3 text-left">Group</th><th className="px-3 py-3 text-left">Unit</th>
              <th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-left">Flags</th>
              <th className="px-3 py-3 text-left">Status</th><th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(t => (
              <tr key={t.code} className="hover:bg-muted/30">
                <td className="px-5 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{t.code}</code></td>
                <td className="px-3 py-3 font-medium">{t.name}</td>
                <td className="px-3 py-3 text-muted-foreground">{t.trade}</td>
                <td className="px-3 py-3 text-muted-foreground">{t.group}</td>
                <td className="px-3 py-3 text-muted-foreground">{t.unit}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(t.rate)}</td>
                <td className="px-3 py-3"><div className="flex gap-1">{t.flags.map(f => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info">{f}</span>)}</div></td>
                <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-5 py-3 text-right"><button aria-label={`Edit ${t.code}`} onClick={() => open(t)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={close} title={editing ? `Edit task — ${editing.code}` : "New task"} size="lg">
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{err}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Code" required hint="Unique short code">
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
            <Field label="Group">
              <input value={form.group} onChange={e=>setForm(f=>({...f, group:e.target.value}))} className={inputCls} placeholder="e.g. KF, Walls" />
            </Field>
            <Field label="Unit" required>
              <input required value={form.unit} onChange={e=>setForm(f=>({...f, unit:e.target.value}))} className={inputCls} placeholder="per item / per m² / per door" />
            </Field>
            <Field label="Rate (£)" required>
              <input required type="number" min={0} step="0.01" value={form.rate} onChange={e=>setForm(f=>({...f, rate:Number(e.target.value)}))} className={inputCls} />
            </Field>
            <Field label="Status" required>
              <select value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value}))} className={inputCls}>
                <option>Active</option><option>Inactive</option>
              </select>
            </Field>
            <Field label="Flags">
              <div className="flex flex-wrap gap-2 pt-1">
                {FLAGS.map(f => (
                  <button type="button" key={f} onClick={()=>toggleFlag(f)} className={`text-[11px] px-2 py-1 rounded border ${form.flags.includes(f) ? "bg-info/10 text-info border-info/40" : "border-input text-muted-foreground"}`}>{f}</button>
                ))}
              </div>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : (editing ? "Save changes" : "Create task")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
