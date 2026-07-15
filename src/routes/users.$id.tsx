import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, TextField, SelectField, CheckboxField, SubmitButton } from "@/components/form";
import { usersService, type UpdateUserPayload } from "@/lib/api/services/users";
import { lookupsService } from "@/lib/api/services/lookups";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { usersQueryKey } from "./users.index";

export const Route = createFileRoute("/users/$id")({
  head: ({ params }) => ({ meta: [{ title: `User #${params.id} — Schore` }] }),
  component: UserDetail,
});

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  userTypeId: z.string().min(1, "User type is required"),
  roleId: z.string().min(1, "Role is required"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

function UserDetail() {
  const { id } = Route.useParams();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDel, setConfirmDel] = useState(false);

  const userQuery = useQuery({
    queryKey: ["users", id],
    queryFn: async () => (await usersService.get(id)).data,
  });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: async () => (await lookupsService.roles()).data });
  const typesQuery = useQuery({ queryKey: ["userTypes"], queryFn: async () => (await lookupsService.userTypes()).data });

  const user = userQuery.data;

  const defaults = useMemo<Values>(
    () => ({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      userTypeId: user?.userTypeId != null ? String(user.userTypeId) : "",
      roleId: user?.roleIds?.[0] != null ? String(user.roleIds[0]) : "",
      isActive: user?.isActive ?? true,
    }),
    [user],
  );

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => { if (user) form.reset(defaults); }, [user, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUserPayload) => usersService.update(numericId, payload),
    onSuccess: res => {
      toast.success("User updated");
      queryClient.setQueryData(["users", id], res.data);
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to update user"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersService.remove(numericId),
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      navigate({ to: "/users" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete user"),
  });

  async function save(values: Values) {
    const payload: UpdateUserPayload = {
      email: values.email.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      isActive: values.isActive,
      userTypeId: Number(values.userTypeId),
      roleIds: [Number(values.roleId)],
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
          {(userQuery.error as unknown as ApiError)?.message || "This account may have been deleted."}
        </p>
        <Button className="mt-4" asChild><Link to="/users">Back to users</Link></Button>
      </div>
    );
  }

  const dirty = form.formState.isDirty;
  const displayName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username;
  const lookupsLoading = rolesQuery.isLoading || typesQuery.isLoading;

  return (
    <div className="space-y-6">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All users
      </Link>

      <PageHeader
        title={displayName}
        subtitle={user.email}
        actions={
          <>
            <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${user.isActive ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
              {user.isActive ? "Active" : "Inactive"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setConfirmDel(true)}
            >
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Form form={form} onSubmit={save} className="lg:col-span-2 card-elevated p-6 space-y-4">
          <h3 className="font-display font-semibold">Edit details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField<Values> name="firstName" label="First name" required />
            <TextField<Values> name="lastName" label="Last name" required />
            <TextField<Values> name="email" label="Email" required type="email" />
            <TextField name="username" label="Username" disabled value={user.username} readOnly />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField<Values>
              name="userTypeId"
              label="User type"
              required
              disabled={lookupsLoading}
              options={(typesQuery.data ?? []).map(t => ({ value: String(t.id), label: t.name }))}
            />
            <SelectField<Values>
              name="roleId"
              label="Role"
              required
              disabled={lookupsLoading}
              options={(rolesQuery.data ?? []).map(r => ({ value: String(r.id), label: r.name, description: r.description ?? undefined }))}
            />
          </div>

          <CheckboxField<Values> name="isActive" label="Active" description="User can sign in." />

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground mr-auto">{dirty ? "Unsaved changes" : "All changes saved"}</span>
            <Button type="button" variant="outline" disabled={!dirty || updateMutation.isPending} onClick={() => form.reset(defaults)}>
              Reset
            </Button>
            <SubmitButton disabled={!dirty || lookupsLoading} loadingText="Saving…">Save changes</SubmitButton>
          </div>
        </Form>

        <div className="space-y-6">
          <div className="card-elevated p-6">
            <h3 className="font-display font-semibold mb-4">Account</h3>
            <dl className="space-y-3 text-sm">
              <Row label="User ID"><code className="text-xs font-mono">{user.id}</code></Row>
              <Row label="Username">{user.username}</Row>
              <Row label="User type">{user.userTypeName}</Row>
              <Row label="Roles">{(user.roleNames ?? []).join(", ") || "—"}</Row>
              <Row label="Created">{user.createdDate?.slice(0, 10) || "—"}</Row>
              <Row label="Last edited">{user.editDate?.slice(0, 10) || "—"}</Row>
            </dl>
          </div>
        </div>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setConfirmDel(false)}>
          <div className="bg-card rounded-lg max-w-md w-full p-6 border" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg">Delete {displayName}?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This permanently removes the account and revokes platform access. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setConfirmDel(false)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete user
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
