import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ROLES, ROLE_DESCRIPTION, usersStore, validateUser, type UserRole, type UserStatus } from "@/lib/users-store";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/users/new")({
  head: () => ({ meta: [{ title: "Add User — Schore" }] }),
  component: NewUser,
});

function NewUser() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    jobTitle: "",
    role: "User" as UserRole,
    status: "Active" as UserStatus,
    sendInvite: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const existingEmails = usersStore.getAll().map(u => u.email);
    const errs = validateUser(
      { name: form.name, email: form.email, role: form.role, phone: form.phone },
      { existingEmails },
    );
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fix the errors below");
      return;
    }
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 550)); // simulate save
      const created = usersStore.create({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        role: form.role,
        status: form.status,
        lastLogin: undefined,
      });
      toast.success(`${created.name} added`, {
        description: form.sendInvite
          ? `Invite email sent to ${created.email}`
          : `${created.role} access granted`,
      });
      navigate({ to: "/users/$id", params: { id: created.id } });
    } catch {
      toast.error("Could not save user", { description: "Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link to="/users" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> All users
      </Link>

      <PageHeader title="Add user" subtitle="Create a platform account and assign a role" />

      <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>
        <Section title="Identity" hint="The name and email used for sign-in and notifications.">
          <Field label="Full name" required error={errors.name}>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sarah Bennett"
              className="input"
              maxLength={80}
              aria-invalid={!!errors.name}
              autoFocus
              disabled={submitting}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Email" required error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="name@schore.co.uk"
                className="input"
                aria-invalid={!!errors.email}
                disabled={submitting}
              />
            </Field>
            <Field label="Phone" error={errors.phone} hint="Optional · 7-20 digits">
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="07700 900000"
                className="input"
                aria-invalid={!!errors.phone}
                disabled={submitting}
              />
            </Field>
          </div>
          <Field label="Job title" hint="Optional · shown in the user list">
            <input
              value={form.jobTitle}
              onChange={e => setForm({ ...form, jobTitle: e.target.value })}
              placeholder="e.g. Site Manager"
              className="input"
              maxLength={60}
              disabled={submitting}
            />
          </Field>
        </Section>

        <Section title="Access" hint="Roles control what this user can see and edit.">
          <Field label="Role" required error={errors.role}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ROLES.map(r => {
                const active = form.role === r;
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setForm({ ...form, role: r })}
                    disabled={submitting}
                    className={`text-left p-3 rounded-md border transition-colors ${active ? "border-accent bg-accent/5" : "border-input hover:bg-accent/5"}`}
                    aria-pressed={active}
                  >
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full border-2 ${active ? "border-accent bg-accent" : "border-input"}`} />
                      {r}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{ROLE_DESCRIPTION[r]}</div>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Status" required>
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as UserStatus })}
              className="input"
              disabled={submitting}
            >
              <option value="Active">Active — can sign in immediately</option>
              <option value="Inactive">Inactive — account created but blocked from sign-in</option>
            </select>
          </Field>

          <label className="flex items-start gap-3 p-3 rounded-md border border-input cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendInvite}
              onChange={e => setForm({ ...form, sendInvite: e.target.checked })}
              disabled={submitting}
              className="mt-0.5"
            />
            <div className="text-sm">
              <div className="font-medium">Send invitation email</div>
              <div className="text-xs text-muted-foreground">User will receive a link to set their password.</div>
            </div>
          </label>
        </Section>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/users" })} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Create user"}
          </Button>
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
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </span>
        {hint && !error && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <div className="text-xs text-destructive" role="alert">{error}</div>}
    </label>
  );
}
