import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/operatives/new")({
  head: () => ({ meta: [{ title: "New Operative | Schore" }] }),
  component: NewOperative,
});

function NewOperative() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", trade: "Carpenter", cis: "20%", dailyRate: 240, phone: "", utr: "", email: "", emergency: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string,string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    else if (form.name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (form.cis !== "0%" && !form.utr.trim()) errs.utr = "UTR required for 20%/30% CIS";
    else if (form.utr.trim() && !/^\d{10}$/.test(form.utr.trim())) errs.utr = "UTR must be 10 digits";
    if (!Number.isFinite(form.dailyRate) || form.dailyRate <= 0) errs.dailyRate = "Must be greater than 0";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Enter a valid email address";
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Please fix the errors below"); return; }
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      toast.success(`${form.name} added to workforce`, { description: `${form.trade} · ${form.cis} CIS · £${form.dailyRate}/day` });
      navigate({ to: "/operatives" });
    } catch {
      toast.error("Could not save operative");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Add operative" subtitle="Workforce builder · the firm owns this list — no developer needed" />

      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <Section title="Identity" hint="Typing this name later auto-loads the trade and dropdowns.">
          <Field label="Full name" required error={errors.name}>
            <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="e.g. Aurelian Popescu" className="input" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Trade" required hint="Auto-loads this trade's dropdowns on allocation">
              <select value={form.trade} onChange={e=>setForm({...form, trade: e.target.value})} className="input">
                {["Carpenter","Plumber","Electrician","Tiler","Painter","Plasterer","Labourer","Multi-trade"].map(t=><option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Start date" hint="Optional">
              <input type="date" className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Payroll" hint="CIS rate drives the deduction on every wage sheet.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="CIS status" required>
              <select value={form.cis} onChange={e=>setForm({...form, cis: e.target.value})} className="input">
                <option value="0%">0% — Gross</option>
                <option value="20%">20% — Net (default)</option>
                <option value="30%">30% — Unverified</option>
              </select>
            </Field>
            <Field label="Daily rate (£)" required error={errors.dailyRate} hint="The day-work floor for MAX rule">
              <input type="number" value={form.dailyRate} onChange={e=>setForm({...form, dailyRate: +e.target.value})} className="input" />
            </Field>
            <Field label="UTR" required={form.cis !== "0%"} error={errors.utr}>
              <input value={form.utr} onChange={e=>setForm({...form, utr: e.target.value})} placeholder="10-digit UTR" className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Contact" hint="Optional. Used for sending wage statements on command.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Phone"><input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} placeholder="07700 900000" className="input" /></Field>
            <Field label="Email" error={errors.email}><input type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="name@email.com" className="input" /></Field>
          </div>
          <Field label="Emergency contact"><input value={form.emergency} onChange={e=>setForm({...form, emergency: e.target.value})} placeholder="Name + phone" className="input" /></Field>
        </Section>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={()=>navigate({ to: "/operatives" })} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save operative"}</Button>
        </div>
      </form>

    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card-elevated p-6 space-y-4">
      <div>
        <h3 className="font-display font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </span>
        {hint && !error && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </label>
  );
}
