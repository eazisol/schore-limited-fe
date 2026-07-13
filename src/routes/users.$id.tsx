import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ROLES,
  ROLE_DESCRIPTION,
  usersStore,
  type AppUser,
  type UserRole,
  type UserStatus,
} from "@/lib/users-store";
import { RoleBadge } from "./users.index";
import { ArrowLeft, Trash2, UserCheck, UserX, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, TextField, RadioGroupField, SelectField, SubmitButton } from "@/components/form";

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

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  phone: z.string().trim().regex(/^[\d +()-]{7,20}$/, "Enter a valid phone number").or(z.literal("")),
  jobTitle: z.string().trim().max(60).or(z.literal("")),
  role: z.enum(["CEO", "CM", "PM", "SM"]),
  status: z.enum(["Active", "Inactive"]),
});
type Values = z.infer<typeof schema>;

function UserDetail() {
  const { id } = Route.useLoaderData();
  const user = usersStore.get(id) as AppUser;
  const navigate = useNavigate();
  const [confirmDel, setConfirmDel] = useState(false);

  const defaults = useMemo<Values>(() => ({
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    jobTitle: user.jobTitle ?? "",
    role: user.role,
    status: user.status,
  }), [user]);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => { form.reset(defaults); }, [defaults, form]);

  async function save(values: Values) {
    const existingEmails = usersStore.getAll()
      .filter(u => u.id !== user.id)
      .map(u => u.email.toLowerCase());
    if (existingEmails.includes(values.email.toLowerCase())) {
      form.setError("email", { message: "A user with this email already exists" });
      return;
    }
    await new Promise(r => setTimeout(r, 350));
    usersStore.update(user.id, {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim() || undefined,
      jobTitle: values.jobTitle.trim() || undefined,
      role: values.role as UserRole,
      status: values.status as UserStatus,
    });
    toast.success("User updated");
  }

  function toggleStatus() {
    const next: UserStatus = user.status === "Active" ? "Inactive" : "Active";
    usersStore.setStatus(user.id, next);
    form.setValue("status", next);
    toast.success(next === "Inactive" ? `${user.name} deactivated` : `${user.name} reactivated`);
  }

  const dirty = form.formState.isDirty;

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
            <Button variant="outline" size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Form form={form} onSubmit={save} className="lg:col-span-2 card-elevated p-6 space-y-4">
          <h3 className="font-display font-semibold">Edit details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField<Values> name="name" label="Full name" required maxLength={80} />
            <TextField<Values> name="email" label="Email" required type="email" />
            <TextField<Values> name="phone" label="Phone" placeholder="07700 900000" />
            <TextField<Values> name="jobTitle" label="Job title" maxLength={60} />
          </div>

          <RadioGroupField<Values>
            name="role"
            label="Role"
            required
            layout="grid"
            options={ROLES.map(r => ({ value: r, label: r, description: ROLE_DESCRIPTION[r] }))}
          />

          <SelectField<Values>
            name="status"
            label="Status"
            required
            options={[
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ]}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground mr-auto">{dirty ? "Unsaved changes" : "All changes saved"}</span>
            <Button type="button" variant="outline" disabled={!dirty} onClick={() => form.reset(defaults)}>
              Reset
            </Button>
            <SubmitButton disabled={!dirty} loadingText="Saving…">Save changes</SubmitButton>
          </div>
        </Form>

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right">{children}</dd>
    </div>
  );
}
