import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, TextField, PasswordField, SelectField, CheckboxField, SubmitButton,
} from "@/components/form";
import { usersService, type ApiUser, type CreateUserPayload } from "@/lib/api/services/users";
import { lookupsService } from "@/lib/api/services/lookups";
import type { ApiError } from "@/lib/api/axios";
import { usersQueryKey } from "./users.index";

export const Route = createFileRoute("/users/new")({
  head: () => ({ meta: [{ title: "Add User — Schore" }] }),
  component: NewUser,
});

const schema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(6, "Password must be at least 6 characters"),
  userTypeId: z.string().min(1, "User type is required"),
  roleId: z.string().min(1, "Role is required"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

function NewUser() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: async () => (await lookupsService.roles()).data });
  const typesQuery = useQuery({ queryKey: ["userTypes"], queryFn: async () => (await lookupsService.userTypes()).data });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "", firstName: "", lastName: "", email: "", password: "",
      userTypeId: "", roleId: "", isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => usersService.create(payload),
    onSuccess: res => {
      toast.success(`${res.data?.firstName || res.data?.username || "User"} created`);
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      const id = res.data?.id;
      if (id != null) navigate({ to: "/users/$id", params: { id: String(id) } });
      else navigate({ to: "/users" });
    },
    onError: (err: ApiError) => {
      toast.error(err?.message || "Failed to create user");
    },
  });

  async function submit(values: Values) {
    const payload: CreateUserPayload = {
      username: values.username.trim(),
      email: values.email.trim(),
      password: values.password,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      isActive: values.isActive,
      userTypeId: Number(values.userTypeId),
      roleIds: [Number(values.roleId)],
    };
    await createMutation.mutateAsync(payload);
  }

  const rolesLoading = rolesQuery.isLoading || typesQuery.isLoading;

  return (
    <div>
      <Link to="/users" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> All users
      </Link>

      <PageHeader title="Add user" subtitle="Create a platform account and assign a role" />

      <Form form={form} onSubmit={submit} className="max-w-3xl space-y-6">
        <Section title="Identity" hint="Login credentials and personal details.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField<Values> name="firstName" label="First name" required autoFocus />
            <TextField<Values> name="lastName" label="Last name" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField<Values> name="username" label="Username" required autoComplete="username" />
            <TextField<Values> name="email" label="Email" required type="email" placeholder="name@schore.co.uk" />
          </div>
          <PasswordField<Values> name="password" label="Password" required autoComplete="new-password" />
        </Section>

        <Section title="Access" hint="Roles control what this user can see and edit.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField<Values>
              name="userTypeId"
              label="User type"
              required
              disabled={rolesLoading}
              options={(typesQuery.data ?? []).map(t => ({ value: String(t.id), label: t.name }))}
            />
            <SelectField<Values>
              name="roleId"
              label="Role"
              required
              disabled={rolesLoading}
              options={(rolesQuery.data ?? []).map(r => ({ value: String(r.id), label: r.name, description: r.description ?? undefined }))}
            />
          </div>
          <CheckboxField<Values>
            name="isActive"
            label="Active"
            description="User can sign in immediately."
          />
        </Section>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/users" })} disabled={createMutation.isPending}>Cancel</Button>
          <SubmitButton loadingText="Saving…" disabled={rolesLoading}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Create user
          </SubmitButton>
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

export type _NewUserApiUnused = ApiUser;
