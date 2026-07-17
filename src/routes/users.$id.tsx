import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
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
import { emailSchema, userNameSchema } from "@/lib/user-validation";
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
  email: emailSchema(),
  phone: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) return;
      if (!validatePhoneNumber(v)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid phone number for the selected country.",
        });
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
  const roles = rolesQuery.data ?? [];
  const rolesReady = rolesQuery.isSuccess;
  const resolvedRoleId = useMemo(() => {
    const apiRoleId = user?.roleIds?.[0];
    if (apiRoleId != null) return String(apiRoleId);
    const roleName = user?.roleNames?.[0]?.trim().toLowerCase();
    if (!roleName) return "";
    return String(roles.find((role) => role.name.trim().toLowerCase() === roleName)?.id ?? "");
  }, [roles, user?.roleIds, user?.roleNames]);

  const roleOptions = useMemo(() => {
    const options = roles.map((r) => ({
      value: String(r.id),
      label: r.name,
      description: r.description ?? undefined,
    }));
    if (resolvedRoleId && !options.some((o) => o.value === resolvedRoleId)) {
      options.unshift({
        value: resolvedRoleId,
        label: user?.roleNames?.[0]?.trim() || `Role #${resolvedRoleId}`,
        description: undefined,
      });
    }
    return options;
  }, [resolvedRoleId, roles, user?.roleNames]);

  const defaults = useMemo<Values>(
    () => ({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      dateOfBirth: toDateInputValue(user?.dateOfBirth),
      roleId: resolvedRoleId,
      isActive: user?.isActive ?? true,
      password: "",
    }),
    [resolvedRoleId, user],
  );

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => {
    if (!user || !rolesReady) return;
    form.reset(defaults);
  }, [user, defaults, form, rolesReady]);

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
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading user…
      </div>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load user</h2>
        <p className="mt-1 text-sm text-muted-foreground">
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
  const roleLabel =
    (user.roleNames ?? []).filter(Boolean).join(", ") ||
    roles.find((r) => String(r.id) === resolvedRoleId)?.name ||
    "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? "Edit user" : "User details"}
        leading={
          <>
            <AppTooltip content="Back to users" asChild>
              <Link
                to="/users"
                aria-label="Back to users"
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {isEditing ? (
          <Form form={form} onSubmit={save} className="card-elevated space-y-4 p-6 lg:col-span-2">
            <h3 className="font-display font-semibold">Edit details</h3>
            <fieldset className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField<Values> name="firstName" label="First name" required maxLength={50} />
                <TextField<Values> name="lastName" label="Last name" required maxLength={50} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField<Values> name="email" label="Email" required type="email" />
                <PhoneNumberField<Values> name="phone" label="Phone" placeholder="07700 900000" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField<Values> name="dateOfBirth" label="Date of birth" type="date" />
                <SelectField<Values>
                  key={`role-${resolvedRoleId}-${roleOptions.length}-${rolesReady ? "ready" : "loading"}`}
                  name="roleId"
                  label="Role"
                  required
                  placeholder={rolesReady ? "Select role" : "Loading roles…"}
                  disabled={lookupsLoading || !rolesReady}
                  options={roleOptions}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <div className="flex items-center justify-end gap-2 border-t pt-2">
              <span className="mr-auto text-xs text-muted-foreground">
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
        ) : (
          <div className="card-elevated space-y-4 p-6 lg:col-span-2">
            <h3 className="font-display font-semibold">Personal details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="First name" value={user.firstName || "—"} />
                <ReadOnlyField label="Last name" value={user.lastName || "—"} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="Email" value={user.email || "—"} />
                <ReadOnlyField label="Phone" value={user.phone || "—"} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField
                  label="Date of birth"
                  value={toDateInputValue(user.dateOfBirth) || "—"}
                />
                <ReadOnlyField label="Role" value={roleLabel} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField
                  label="Status"
                  value={
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        user.isActive
                          ? "border-success/20 bg-success/10 text-success"
                          : "border-destructive/20 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  }
                />
              </div>
            </div>
          </div>
        )}

        <div className="card-elevated self-start p-6">
          <h3 className="mb-4 font-display font-semibold">Account</h3>
          <dl className="space-y-3 text-sm">
            <Row label="User ID">{user.id}</Row>
            <Row label="Created">{formatDateTime(user.createdDate)}</Row>
            <Row label="Last edited">{formatDateTime(user.editDate)}</Row>
          </dl>
        </div>
      </div>

      {confirmDel && canDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmDel(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Delete {displayName}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the account and revokes platform access. This action cannot
              be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
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

function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function formatDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const s = v.replace("T", " ");
  return s.slice(0, 16);
}
