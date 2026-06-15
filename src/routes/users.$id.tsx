import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ROLES,
  ROLE_DESCRIPTION,
  usersStore,
  validateUser,
  type AppUser,
  type UserRole,
  type UserStatus,
} from "@/lib/users-store";
import { RoleBadge } from "./users.index";
import { ArrowLeft, Trash2, UserCheck, UserX, Mail, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/users/$id")({
  loader: ({ params }) => {
    const u = usersStore.get(params.id);
    if (!u) throw notFound();
    return { id: params.id };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${usersStore.get(loaderData?.id ?? "")?.name ?? "User"} — Schore` }] }),
  notFoundComponent: () => (
    <div className="card-elevated p-12 text-center">
      <h2 className="font-display font-semibold text-lg">User not found</h2>
      <p className="text-sm text-muted-foreground mt-1">This account may have been deleted.</p>
      <Button className="mt-4" asChild><Link to="/users">Back to users</Link></Button>
    </div>
  ),
  component: UserDetail,
});

function UserDetail() {
  const { id } = Route.useLoaderData();
  // re-read live so updates re-render
  const user = usersStore.get(id) as AppUser;
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    jobTitle: user.jobTitle ?? "",
    role: user.role as UserRole,
    status: user.status as UserStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const dirty = useMemo(() => (
    form.name !== user.name ||
    form.email !== user.email ||
    (form.phone || "") !== (user.phone || "") ||
    (form.jobTitle || "") !== (user.jobTitle || "") ||
    form.role !== user.role ||
    form.status !== user.status
  ), [form, user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const existingEmails = usersStore.getAll().map(u => u.email);
    const errs = validateUser(
      { name: form.name, email: form.email, role: form.role, phone: form.phone },
      { existingEmails, excludeEmail: user.email },
    );
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fix the errors below");
      return;
    }
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 450));
      usersStore.update(user.id, {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        role: form.role,
        status: form.status,
      });
      toast.success("User updated");
    } catch {
      toast.error("Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  function toggleStatus() {
    const next: UserStatus = user.status === "Active" ? "Inactive" : "Active";
    usersStore.setStatus(user.id, next);
    setForm(f => ({ ...f, status: next }));
    toast.success(next === "Inactive" ? `${user.name} deactivated` : `${user.name} reactivated`);
  }

  return (
    <div className="space-y-6">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All users
      </Link>

      <PageHeader
        title={user.name}
        subtitle={user.email}
        actions={
          <>
            <RoleBadge role={user.role} />
            <StatusBadge status={user.status} />
            <Button variant="outline" size="sm" onClick={toggleStatus}>
              {user.status === "Active" ? <><UserX className="h-4 w-4" />Deactivate</> : <><UserCheck className="h-4 w-4" />Reactivate</>}
            </Button>
            <Button
              variant="outline" size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setConfirmDel(true)}
            >
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={save} className="lg:col-span-2 card-elevated p-6 space-y-4" noValidate>
          <h3 className="font-display font-semibold">Edit details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full name" required error={errors.name}>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" maxLength={80} disabled={saving} />
            </Field>
            <Field label="Email" required error={errors.email}>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" disabled={saving} />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" placeholder="07700 900000" disabled={saving} />
            </Field>
            <Field label="Job title">
              <input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} className="input" maxLength={60} disabled={saving} />
            </Field>
          </div>

          <Field label="Role" required error={errors.role}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ROLES.map(r => {
                const active = form.role === r;
                return (
                  <button
                    type="button" key={r} onClick={() => setForm({ ...form, role: r })} disabled={saving}
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
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as UserStatus })} className="input" disabled={saving}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground mr-auto">{dirty ? "Unsaved changes" : "All changes saved"}</span>
            <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => { setForm({ name: user.name, email: user.email, phone: user.phone ?? "", jobTitle: user.jobTitle ?? "", role: user.role, status: user.status }); setErrors({}); }}>
              Reset
            </Button>
            <Button type="submit" disabled={!dirty || saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="card-elevated p-6">
            <h3 className="font-display font-semibold mb-4">Account</h3>
            <dl className="space-y-3 text-sm">
              <Row label="User ID"><code className="text-xs font-mono">{user.id}</code></Row>
              <Row label="Created">{user.createdAt}</Row>
              <Row label="Last login">{user.lastLogin || "Never"}</Row>
            </dl>
          </div>

          <div className="card-elevated p-6">
            <h3 className="font-display font-semibold mb-3">Quick actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("Password reset email sent", { description: user.email })}>
                <KeyRound className="h-4 w-4" /> Send password reset
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("Invitation re-sent", { description: user.email })}>
                <Mail className="h-4 w-4" /> Re-send invitation
              </Button>
            </div>
          </div>
        </div>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setConfirmDel(false)}>
          <div className="bg-card rounded-lg max-w-md w-full p-6 border" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg">Delete {user.name}?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This permanently removes the account and revokes platform access. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setConfirmDel(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { usersStore.remove(user.id); toast.success(`${user.name} deleted`); navigate({ to: "/users" }); }}>
                <Trash2 className="h-4 w-4" /> Delete user
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {error && <div className="text-xs text-destructive" role="alert">{error}</div>}
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right">{children}</dd>
    </div>
  );
}
