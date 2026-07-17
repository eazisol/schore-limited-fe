import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Loader2,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  Form,
  TextField,
  SelectField,
  CheckboxField,
  SubmitButton,
  PhoneNumberField,
  PasswordField,
} from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import {
  resolveProfileImageUrl,
  usersService,
  toDateInputValue,
  type UpdateUserPayload,
} from "@/lib/api/services/users";
import { lookupsService } from "@/lib/api/services/lookups";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { usersQueryKey } from "./users.index";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { userNameSchema } from "@/lib/user-validation";
import { newPasswordSchema, PasswordRequirements } from "@/lib/password";

const USERS_ROUTE = "/users";

const userDetailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/users/$id")({
  head: ({ params }) => ({ meta: [{ title: `User #${params.id} | Schore` }] }),
  validateSearch: userDetailSearchSchema,
  component: UserDetail,
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
  password: z.string().superRefine((value, ctx) => {
    if (!value.trim()) return;
    const parsed = newPasswordSchema.safeParse(value);
    if (parsed.success) return;
    for (const issue of parsed.error.issues) {
      ctx.addIssue({ ...issue, path: [] });
    }
  }),
});
type Values = z.infer<typeof schema>;

function UserDetail() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: USERS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: USERS_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;

  function openEdit() {
    navigate({
      to: "/users/$id",
      params: { id },
      search: { mode: "edit" },
      replace: true,
    });
  }

  function openView() {
    navigate({
      to: "/users/$id",
      params: { id },
      search: {},
      replace: true,
    });
  }

  const userQuery = useQuery({
    queryKey: ["users", id],
    queryFn: async () => (await usersService.get(id)).data,
  });
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await lookupsService.roles()).data,
  });
  const user = userQuery.data;

  const defaults = useMemo<Values>(
    () => ({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      dateOfBirth: toDateInputValue(user?.dateOfBirth),
      roleId: user?.roleIds?.[0] != null ? String(user.roleIds[0]) : "",
      isActive: user?.isActive ?? true,
      password: "",
    }),
    [user],
  );

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => {
    if (user) form.reset(defaults);
  }, [user, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUserPayload) => usersService.update(numericId, payload),
    onSuccess: (res) => {
      toast.success(res.message || "User updated");
      queryClient.setQueryData(["users", id], res.data);
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      navigate({ to: "/users" });
    },
    onError: (err) => notifyApiError(err, "Failed to update user"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersService.remove(numericId),
    onSuccess: (res) => {
      toast.success(res.message || "User deleted");
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      navigate({ to: "/users" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete user"),
  });

  async function save(values: Values) {
    const nextPassword = values.password.trim();
    const payload: UpdateUserPayload = {
      email: values.email.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim() || null,
      dateOfBirth: values.dateOfBirth.trim() || null,
      isActive: values.isActive,
      userTypeId: user?.userTypeId ?? 0,
      roleIds: [Number(values.roleId)],
      ...(nextPassword ? { password: nextPassword } : {}),
    };
    await updateMutation.mutateAsync(payload);
  }

  if (userQuery.isLoading) {
    return (
      <div className="card-elevated p-12 grid place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mb-2" />
        Loading user…
      </div>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="h-5 w-5 mx-auto text-destructive mb-2" />
        <h2 className="font-display font-semibold text-lg">Unable to load user</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {(userQuery.error as unknown as ApiError)?.message ||
            "This account may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/users">Back to users</Link>
        </Button>
      </div>
    );
  }

  const dirty = form.formState.isDirty;
  const password = form.watch("password");
  const displayName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username;
  const lookupsLoading = rolesQuery.isLoading;
  const profileImageUrl = resolveProfileImageUrl(user.profileImagePath);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? "Edit user" : "User details"}
        leading={
          <>
            <Link
              to="/users"
              aria-label="Back to users"
              title="Back to users"
              className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {!isEditing && profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt="User profile"
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : null}
          </>
        }
        actions={
          <>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${user.isActive ? "border-success/20 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground"}`}
            >
              {user.isActive ? "Active" : "Inactive"}
            </span>
            {!isEditing && canModify && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
                Edit user
              </Button>
            )}
            <Can route={USERS_ROUTE} action="delete">
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </Can>
          </>
        }
      />

      {isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Form form={form} onSubmit={save} className="lg:col-span-2 card-elevated p-6 space-y-4">
            <h3 className="font-display font-semibold">Edit details</h3>

            <fieldset className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField<Values> name="firstName" label="First name" required maxLength={50} />
                <TextField<Values> name="lastName" label="Last name" required maxLength={50} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField<Values> name="email" label="Email" required type="email" />
                <PhoneNumberField<Values> name="phone" label="Phone" placeholder="07700 900000" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField<Values> name="dateOfBirth" label="Date of birth" type="date" />
                <SelectField<Values>
                  name="roleId"
                  label="Role"
                  required
                  placeholder="Select role"
                  disabled={lookupsLoading}
                  options={(rolesQuery.data ?? []).map((r) => ({
                    value: String(r.id),
                    label: r.name,
                    description: r.description ?? undefined,
                  }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <PasswordField<Values>
                    name="password"
                    label="Password"
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current password"
                  />
                  {password ? <PasswordRequirements password={password} /> : null}
                </div>
              </div>

              <CheckboxField<Values> name="isActive" label="Active" description="User can sign in." />
            </fieldset>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground mr-auto">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => {
                  form.reset(defaults);
                  openView();
                }}
              >
                Cancel
              </Button>
              <SubmitButton disabled={!dirty || lookupsLoading} loadingText="Saving…">
                Save changes
              </SubmitButton>
            </div>
          </Form>

          <div className="card-elevated p-6 self-start">
            <h3 className="font-display font-semibold mb-4">Account</h3>
            <dl className="space-y-3 text-sm">
              <Row label="User ID">{user.id}</Row>
              <Row label="Created">{formatDateTime(user.createdDate)}</Row>
              <Row label="Last edited">{formatDateTime(user.editDate)}</Row>
            </dl>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <InformationCard title="Personal information" icon={UserRound}>
            <InfoItem icon={UserRound} label="Full name" value={displayName} />
            <InfoItem icon={Phone} label="Phone" value={user.phone || "—"} />
            <InfoItem icon={ShieldCheck} label="Role" value={(user.roleNames ?? []).join(", ") || "—"} />
            <InfoItem icon={Mail} label="Email" value={user.email} />
            <InfoItem
              icon={CalendarDays}
              label="Date of birth"
              value={toDateInputValue(user.dateOfBirth) || "—"}
            />
            <InfoItem
              icon={Activity}
              label="Status"
              value={user.isActive ? "Active" : "Inactive"}
              status={user.isActive}
            />
          </InformationCard>
        </div>
      )}

      {confirmDel && canDelete && (
        <div
          className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4"
          onClick={() => setConfirmDel(false)}
        >
          <div
            className="bg-card rounded-lg max-w-md w-full p-6 border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-semibold text-lg">Delete {displayName}?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This permanently removes the account and revokes platform access. This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setConfirmDel(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete user
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InformationCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="card-elevated p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-display font-semibold">{title}</h2>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </section>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  status?: boolean;
}) {
  return (
    <div className="flex min-w-0 gap-3 lg:border-r lg:pr-6 lg:last:border-r-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-1 break-words text-sm font-medium">
          {status === undefined ? (
            value
          ) : (
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${
                status
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-destructive/20 bg-destructive/10 text-destructive"
              }`}
            >
              {value}
            </span>
          )}
        </dd>
      </div>
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

function formatDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const s = v.replace("T", " ");
  return s.slice(0, 16);
}
