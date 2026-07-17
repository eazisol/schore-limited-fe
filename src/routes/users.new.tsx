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
  Form,
  TextField,
  PasswordField,
  SelectField,
  CheckboxField,
  SubmitButton,
  PhoneNumberField,
} from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { usersService, type ApiUser, type CreateUserPayload } from "@/lib/api/services/users";
import { lookupsService } from "@/lib/api/services/lookups";
import { notifyApiError } from "@/lib/api/axios";
import { usersQueryKey } from "./users.index";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { newPasswordSchema, PasswordRequirements } from "@/lib/password";
import { userNameSchema } from "@/lib/user-validation";

const USERS_ROUTE = "/users";

export const Route = createFileRoute("/users/new")({
  head: () => ({ meta: [{ title: "Add User | Schore" }] }),
  component: NewUser,
});

function parseDobInput(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function validatePhoneNumber(value: string) {
  if (!value.trim()) return true;
  return !getPhoneLengthError(value.trim(), undefined, { requireMin: true });
}

const schema = z.object({
  firstName: userNameSchema("First name"),
  lastName: userNameSchema("Last name"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: newPasswordSchema,
  phone: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) return;
      if (!validatePhoneNumber(v)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number for the selected country." });
      }
    }),
  dateOfBirth: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) return;
      const d = parseDobInput(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date of birth." });
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d.getTime() > today.getTime()) {
        ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future." });
      }
    }),
  roleId: z.string().min(1, "Role is required"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

function NewUser() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await lookupsService.roles()).data,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const typesQuery = useQuery({
    queryKey: ["userTypes"],
    queryFn: async () => (await lookupsService.userTypes()).data,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      dateOfBirth: "",
      roleId: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => usersService.create(payload),
    onSuccess: (res) => {
      toast.success(`${res.data?.firstName || res.data?.username || "User"} created`);
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      navigate({ to: "/users" });
    },
    onError: (err) => notifyApiError(err, "Failed to create user"),
  });

  async function submit(values: Values) {
    const types = typesQuery.data ?? [];
    const defaultType =
      types.find((type) => type.name?.toLowerCase().includes("system")) ?? types[0];
    const payload: CreateUserPayload = {
      username: values.email.trim(),
      email: values.email.trim(),
      password: values.password,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim() || null,
      dateOfBirth: values.dateOfBirth.trim() || null,
      isActive: values.isActive,
      userTypeId: defaultType ? Number(defaultType.id) : 0,
      roleIds: [Number(values.roleId)],
    };
    await createMutation.mutateAsync(payload);
  }

  const rolesLoading = rolesQuery.isLoading || typesQuery.isLoading;
  const password = form.watch("password");

  return (
    <RequirePermission route={USERS_ROUTE} action="modify">
      <div>
        <PageHeader
          title="Add User"
          leading={
            <Link
              to="/users"
              aria-label="Back to users"
              title="Back to users"
              className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          }
        />

        <Form form={form} onSubmit={submit} className="max-w-3xl space-y-6">
          <Section title="Personal Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField<Values>
                name="firstName"
                label="First name"
                required
                autoFocus
                maxLength={50}
              />
              <TextField<Values> name="lastName" label="Last name" required maxLength={50} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField<Values>
                name="email"
                label="Email"
                required
                type="email"
                placeholder="name@schore.co.uk"
              />
              <PhoneNumberField<Values> name="phone" label="Phone" placeholder="07700 900000" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <PasswordField<Values>
                  name="password"
                  label="Password"
                  required
                  autoComplete="new-password"
                />
                <PasswordRequirements password={password} />
              </div>
              <TextField<Values> name="dateOfBirth" label="Date of birth" type="date" />
            </div>
          </Section>

          <Section title="Access" hint="Roles control what this user can see and edit.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField<Values>
                name="roleId"
                label="Role"
                required
                placeholder="Select role"
                disabled={rolesLoading}
                options={(rolesQuery.data ?? []).map((r) => ({
                  value: String(r.id),
                  label: r.name,
                  description: r.description ?? undefined,
                }))}
              />
            </div>
            <CheckboxField<Values>
              name="isActive"
              label="Active"
              description="User can sign in immediately."
            />
          </Section>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/users" })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton loadingText="Saving…" disabled={rolesLoading}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create user
            </SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
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
