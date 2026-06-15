import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal, Field, inputCls } from "@/components/Modal";

export const Route = createFileRoute("/legend-codes")({
  head: () => ({ meta: [{ title: "Legend Codes — Schore" }] }),
  component: Legends,
});

interface Legend { code: string; meaning: string; trade: string; pay: string; split: boolean; isStatus: boolean }

const seed: Legend[] = [
  { code: "L",   meaning: "Labourer",            trade: "Labourer",    pay: "Day Work",   split: false, isStatus: false },
  { code: "Pl",  meaning: "Plumber",             trade: "Plumber",     pay: "Day Work",   split: false, isStatus: false },
  { code: "E",   meaning: "Electrician",         trade: "Electrician", pay: "Day Work",   split: false, isStatus: false },
  { code: "C1",  meaning: "Carcass 1",           trade: "Carpenter",   pay: "Price Work", split: true,  isStatus: false },
  { code: "C2",  meaning: "Carcass 2",           trade: "Carpenter",   pay: "Price Work", split: true,  isStatus: false },
  { code: "C3",  meaning: "Carcass 3",           trade: "Carpenter",   pay: "Price Work", split: true,  isStatus: false },
  { code: "KF",  meaning: "Kitchen Fit",         trade: "Carpenter",   pay: "Price Work", split: false, isStatus: false },
  { code: "T",   meaning: "Tiler",               trade: "Tiler",       pay: "Price Work", split: false, isStatus: false },
  { code: "D",   meaning: "Decorator",           trade: "Painter",     pay: "Price Work", split: false, isStatus: false },
  { code: "V",   meaning: "Void",                trade: "—",           pay: "—",          split: false, isStatus: true  },
  { code: "HM",  meaning: "Held — Materials",    trade: "—",           pay: "—",          split: false, isStatus: true  },
  { code: "RFH", meaning: "Reroute Floor Heat",  trade: "Plumber",     pay: "Price Work", split: false, isStatus: false },
  { code: "ASB", meaning: "Asbestos delay",      trade: "—",           pay: "—",          split: false, isStatus: true  },
  { code: "S1",  meaning: "Snag 1",              trade: "—",           pay: "—",          split: false, isStatus: true  },
];

const TRADES = ["—", "Carpenter", "Plumber", "Electrician", "Tiler", "Labourer", "Painter", "Plasterer"];
const PAY = ["—", "Day Work", "Price Work"];

function Legends() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(seed);
  const [editing, setEditing] = useState<Legend | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Legend>({ code: "", meaning: "", trade: TRADES[0], pay: PAY[0], split: false, isStatus: false });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const open = (l: Legend | null) => {
    setErr("");
    if (l) { setEditing(l); setForm(l); }
    else { setEditing(null); setCreating(true); setForm({ code: "", meaning: "", trade: TRADES[0], pay: PAY[0], split: false, isStatus: false }); }
  };
  const close = () => { setEditing(null); setCreating(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.meaning.trim()) { setErr("Code and meaning are required."); return; }
    if (!editing && rows.some(r => r.code.toLowerCase() === form.code.trim().toLowerCase())) {
      setErr("A legend with that code already exists."); return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 450));
    setRows(curr => editing ? curr.map(r => r.code === editing.code ? form : r) : [...curr, form]);
    setSaving(false);
    toast.success(editing ? `Legend updated — ${form.code}` : `Legend created — ${form.code}`);
    close();
  };

  const filtered = rows.filter(l => !q || l.code.toLowerCase().includes(q.toLowerCase()) || l.meaning.toLowerCase().includes(q.toLowerCase()));
  const modalOpen = creating || editing !== null;

  return (
    <div>
      <PageHeader
        title="Legend Codes"
        subtitle="Single source of truth for codes used on the Daily Programme."
        actions={<Button size="sm" onClick={() => open(null)}><Plus className="h-4 w-4" />New legend</Button>}
      />
      <div className="card-elevated mb-4 p-4">
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search code or meaning…" className="bg-transparent text-sm outline-none w-full" />
        </div>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Code</th><th className="px-3 py-3 text-left">Meaning</th>
              <th className="px-3 py-3 text-left">Trade</th><th className="px-3 py-3 text-left">Pay Type</th>
              <th className="px-3 py-3 text-left">Cost Split</th><th className="px-3 py-3 text-left">Type</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(l => (
              <tr key={l.code} className="hover:bg-muted/30">
                <td className="px-5 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{l.code}</code></td>
                <td className="px-3 py-3 font-medium">{l.meaning}</td>
                <td className="px-3 py-3 text-muted-foreground">{l.trade}</td>
                <td className="px-3 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${l.pay === "Price Work" ? "bg-info/10 text-info" : l.pay === "Day Work" ? "bg-accent/15 text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{l.pay}</span></td>
                <td className="px-3 py-3 text-muted-foreground">{l.split ? "Yes" : "No"}</td>
                <td className="px-3 py-3">{l.isStatus ? <StatusBadge status="On Hold" /> : <span className="text-[11px] text-muted-foreground">Work</span>}</td>
                <td className="px-5 py-3 text-right"><button aria-label={`Edit ${l.code}`} onClick={() => open(l)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No legend codes match your search.</div>}
      </div>

      <Modal open={modalOpen} onClose={close} title={editing ? `Edit legend — ${editing.code}` : "New legend"} subtitle="Admin only">
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{err}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Code" required>
              <input required value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className={inputCls} disabled={!!editing} />
            </Field>
            <Field label="Meaning" required>
              <input required value={form.meaning} onChange={e=>setForm(f=>({...f, meaning:e.target.value}))} className={inputCls} />
            </Field>
            <Field label="Trade" required>
              <select value={form.trade} onChange={e=>setForm(f=>({...f, trade:e.target.value}))} className={inputCls}>
                {TRADES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Pay type" required>
              <select value={form.pay} onChange={e=>setForm(f=>({...f, pay:e.target.value}))} className={inputCls}>
                {PAY.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Cost split">
              <label className="inline-flex items-center gap-2 text-sm h-9">
                <input type="checkbox" checked={form.split} onChange={e=>setForm(f=>({...f, split:e.target.checked}))} />
                Split cost across operatives
              </label>
            </Field>
            <Field label="Status code">
              <label className="inline-flex items-center gap-2 text-sm h-9">
                <input type="checkbox" checked={form.isStatus} onChange={e=>setForm(f=>({...f, isStatus:e.target.checked}))} />
                This is a status/hold code (not work)
              </label>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : (editing ? "Save changes" : "Create legend")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
