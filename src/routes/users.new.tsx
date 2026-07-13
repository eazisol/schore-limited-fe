import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ROLES, ROLE_DESCRIPTION, usersStore, type UserRole, type UserStatus } from "@/lib/users-store";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, TextField, RadioGroupField, SelectField, CheckboxField, SubmitButton } from "@/components/form";

export const Route = createFileRoute("/users/new")({
  head: () => ({ meta: [{ title: "Add User — Schore" }] }),
  component: NewUser,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name must be under 80 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  phone: z.string().trim().regex(/^[\d +()-]{7,20}$/, "Enter a valid phone number").or(z.literal("")),
  jobTitle: z.string().trim().max(60).or(z.literal("")),
  role: z.enum(["CEO", "CM", "PM", "SM"]),
  status: z.enum(["Active", "Inactive"]),
  sendInvite: z.boolean(),
});
type Values = z.infer<typeof schema>;

function NewUser() {
  const navigate = useNavigate();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", jobTitle: "", role: "SM", status: "Active", sendInvite: true },
  });

  async function submit(values: Values) {
    const existingEmails = usersStore.getAll().map(u => u.email.toLowerCase());
    if (existingEmails.includes(values.email.toLowerCase())) {
      form.setError("email", { message: "A user with this email already exists" });
      toast.error("Please fix the errors below");
      return;
    }
    await new Promise(r => setTimeout(r, 400));
    const created = usersStore.create({
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim() || undefined,
      jobTitle: values.jobTitle.trim() || undefined,
      role: values.role as UserRole,
      status: values.status as UserStatus,
      lastLogin: undefined,
    });
    toast.success(`${created.name} added`, {
      description: values.sendInvite ? `Invite email sent to ${created.email}` : `${created.role} access granted`,
    });
    navigate({ to: "/users/$id", params: { id: created.id } });
  }

  return (
    <div>
      <Link to="/users" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> All users
      </Link>

      <PageHeader title="Add user" subtitle="Create a platform account and assign a role" />

      <Form form={form} onSubmit={submit} className="max-w-3xl space-y-6">
        <Section title="Identity" hint="The name and email used for sign-in and notifications.">
          <TextField<Values> name="name" label="Full name" required placeholder="e.g. Sarah Bennett" maxLength={80} autoFocus />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField<Values> name="email" label="Email" required type="email" placeholder="name@schore.co.uk" />
            <TextField<Values> name="phone" label="Phone" placeholder="07700 900000" description="Optional · 7–20 digits" />
          </div>
          <TextField<Values> name="jobTitle" label="Job title" placeholder="e.g. Site Manager" maxLength={60} description="Optional · shown in the user list" />
        </Section>

        <Section title="Access" hint="Roles control what this user can see and edit.">
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
              { value: "Active", label: "Active", description: "Can sign in immediately" },
              { value: "Inactive", label: "Inactive", description: "Account created but blocked from sign-in" },
            ]}
          />
          <CheckboxField<Values>
            name="sendInvite"
            label="Send invitation email"
            description="User will receive a link to set their password."
          />
        </Section>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/users" })}>Cancel</Button>
          <SubmitButton loadingText="Saving…">Create user</SubmitButton>
        </div>
      </Form>
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
