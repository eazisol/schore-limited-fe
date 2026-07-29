import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { DetailField, DetailMetaRow } from "@/components/DetailField";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { UserFormFields } from "@/components/users/UserFormFields";
import { displayUserName } from "@/components/users/UsersListPage";
import {
  resolveProfileImageUrl,
  usersService,
  toDateInputValue,
} from "@/lib/api/services/users";
import { lookupsService } from "@/lib/api/services/lookups";
import { tradesService } from "@/lib/api/services/trades";
import { cisService } from "@/lib/api/services/cis";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { activeStatusClass, formatCisRate, formatDailyRate, formatDateTime } from "@/lib/module-ui";
import { useUserModuleMode, userModuleConfig } from "@/lib/user-module";
import {
  editUserFormSchema,
  emptyUserFormValues,
  toUpdateUserPayload,
  type UserFormValues,
} from "@/lib/user-form";

export function UserDetailPage() {
  const mode = useUserModuleMode();
  const cfg = userModuleConfig(mode);
  const params = useParams({ strict: false }) as { id?: string };
  const search = useSearch({ strict: false }) as { mode?: "edit" | "view" };
  const id = String(params.id ?? "");
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: cfg.permissionRoute, action: "modify" });
  const canDelete = usePermission({ route: cfg.permissionRoute, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = search.mode === "edit" && canModify;
  const schema = editUserFormSchema(mode);

  function openEdit() {
    navigate({
      to: cfg.detailPath,
      params: { id },
      search: { mode: "edit" },
      replace: true,
    });
  }

  function openView() {
    navigate({
      to: cfg.detailPath,
      params: { id },
      search: {},
      replace: true,
    });
  }

  const userQuery = useQuery({
    queryKey: [...cfg.queryKey, id],
    queryFn: async () => (await usersService.get(id)).data,
    enabled: Boolean(id),
  });
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await lookupsService.roles()).data,
    enabled: mode === "user",
  });
  const tradesQuery = useQuery({
    queryKey: ["trades", "options"],
    queryFn: async () => (await tradesService.options()).data,
    enabled: cfg.isOperative,
  });
  const cisQuery = useQuery({
    queryKey: ["cis", "options"],
    queryFn: async () => (await cisService.options()).data,
    enabled: cfg.isOperative,
  });

  const user = userQuery.data;
  const roles = rolesQuery.data ?? [];
  const trades = tradesQuery.data ?? [];
  const cisOptions = cisQuery.data ?? [];
  const lookupsReady =
    (mode !== "user" || rolesQuery.isSuccess) &&
    (!cfg.isOperative || (tradesQuery.isSuccess && cisQuery.isSuccess));

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

  const tradeOptions = useMemo(() => {
    const options = trades.map((t) => ({ value: String(t.id), label: t.name }));
    if (
      user?.tradeId != null &&
      !options.some((o) => o.value === String(user.tradeId))
    ) {
      options.unshift({
        value: String(user.tradeId),
        label: user.tradeName || `Trade #${user.tradeId}`,
      });
    }
    return options;
  }, [trades, user?.tradeId, user?.tradeName]);

  const cisSelectOptions = useMemo(() => {
    const options = cisOptions.map((c) => ({
      value: String(c.id),
      label: `${c.name} (${formatCisRate(c.rate)})`,
    }));
    if (user?.cisId != null && !options.some((o) => o.value === String(user.cisId))) {
      options.unshift({
        value: String(user.cisId),
        label: user.cisName || `CIS #${user.cisId}`,
      });
    }
    return options;
  }, [cisOptions, user?.cisId, user?.cisName]);

  const defaults = useMemo<UserFormValues>(
    () => ({
      ...emptyUserFormValues,
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      dateOfBirth: toDateInputValue(user?.dateOfBirth),
      roleId: resolvedRoleId,
      isActive: user?.isActive ?? true,
      password: "",
      tradeId: user?.tradeId != null ? String(user.tradeId) : "",
      cisId: user?.cisId != null ? String(user.cisId) : "",
      dailyRate:
        user?.dailyRate != null && !Number.isNaN(Number(user.dailyRate))
          ? String(user.dailyRate)
          : "",
      contactName: user?.contactName ?? "",
      address: user?.address ?? "",
      zipCode: user?.zipCode ?? "",
      city: user?.city ?? "",
      state: user?.state ?? "",
      country: user?.country ?? "",
      contractorId: user?.contractorId != null ? String(user.contractorId) : "",
      startDate: toDateInputValue(user?.startDate),
      endDate: toDateInputValue(user?.endDate),
    }),
    [resolvedRoleId, user],
  );

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (!user || !lookupsReady) return;
    form.reset(defaults);
  }, [user, defaults, form, lookupsReady]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toUpdateUserPayload>) =>
      usersService.update(numericId, payload),
    onSuccess: (res) => {
      toast.success(res.message || `${cfg.labels.entityTitle} updated`);
      queryClient.setQueryData([...cfg.queryKey, id], res.data);
      queryClient.invalidateQueries({ queryKey: cfg.queryKey });
      navigate({ to: cfg.listPath });
    },
    onError: (err) => notifyApiError(err, `Failed to update ${cfg.labels.entity}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersService.remove(numericId),
    onSuccess: (res) => {
      toast.success(res.message || `${cfg.labels.entityTitle} deleted`);
      queryClient.invalidateQueries({ queryKey: cfg.queryKey });
      navigate({ to: cfg.listPath });
    },
    onError: (err) => notifyApiError(err, `Failed to delete ${cfg.labels.entity}`),
  });

  async function save(values: UserFormValues) {
    await updateMutation.mutateAsync(toUpdateUserPayload(values, mode));
  }

  if (userQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        {cfg.labels.loadingDetail}
      </div>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">
          Unable to load {cfg.labels.entity}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(userQuery.error as unknown as ApiError)?.message ||
            "This account may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to={cfg.listPath}>{cfg.labels.backLabel}</Link>
        </Button>
      </div>
    );
  }

  const dirty = form.formState.isDirty;
  const lookupsLoading =
    (mode === "user" && rolesQuery.isLoading) ||
    (cfg.isOperative && (tradesQuery.isLoading || cisQuery.isLoading));
  const profileImageUrl = resolveProfileImageUrl(user.profileImagePath);
  const roleLabel =
    (user.roleNames ?? []).filter(Boolean).join(", ") ||
    roles.find((r) => String(r.id) === resolvedRoleId)?.name ||
    "—";
  const name = displayUserName(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? cfg.labels.editTitle : cfg.labels.viewTitle}
        leading={
          <>
            <AppTooltip content={cfg.labels.backLabel} asChild>
              <Link
                to={cfg.listPath}
                aria-label={cfg.labels.backLabel}
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
            {!isEditing && profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={`${cfg.labels.entityTitle} profile`}
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
                {cfg.labels.editButton}
              </Button>
            )}
            <Can route={cfg.permissionRoute} action="delete">
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
          <Form form={form} onSubmit={save} className="space-y-6 lg:col-span-2">
            <UserFormFields
              mode={mode}
              variant="edit"
              disabled={updateMutation.isPending}
              lookupsLoading={lookupsLoading || !lookupsReady}
              roleOptions={roleOptions}
              tradeOptions={tradeOptions}
              cisOptions={cisSelectOptions}
              contractorSelectedLabel={user.contractorName}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
              <span className="text-xs text-muted-foreground sm:mr-auto">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    form.reset(defaults);
                    openView();
                  }}
                >
                  Cancel
                </Button>
                <SubmitButton size="sm" disabled={!dirty || lookupsLoading} loadingText="Saving…">
                  Save changes
                </SubmitButton>
              </div>
            </div>
          </Form>
        ) : (
          <div className="space-y-6 lg:col-span-2">
            <div className="card-elevated space-y-5 p-4 sm:p-6">
              <h3 className="font-display font-semibold">Personal details</h3>
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <DetailField label="First name" value={user.firstName || "—"} />
                  <DetailField label="Last name" value={user.lastName || "—"} />
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <DetailField label="Email" value={user.email || "—"} />
                  <DetailField label="Phone" value={user.phone || "—"} />
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {!cfg.isContractor ? (
                    <DetailField
                      label="Date of birth"
                      value={toDateInputValue(user.dateOfBirth) || "—"}
                    />
                  ) : null}
                  {cfg.isOperative || cfg.isContactModule ? (
                    <DetailField
                      label="Status"
                      value={
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(user.isActive)}`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      }
                    />
                  ) : (
                    <DetailField label="Role" value={roleLabel} />
                  )}
                </div>
                {cfg.isOperative ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <DetailField
                      label="Joining Date"
                      value={toDateInputValue(user.startDate) || "—"}
                    />
                    <DetailField
                      label="Leaving Date"
                      value={toDateInputValue(user.endDate) || "—"}
                    />
                  </div>
                ) : null}
                {cfg.isCustomer ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <DetailField label="Contractor" value={user.contractorName || "—"} />
                      <DetailField label="Address" value={user.address || "—"} />
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailField label="City" value={user.city || "—"} />
                      <DetailField label="State" value={user.state || "—"} />
                      <DetailField label="Country" value={user.country || "—"} />
                      <DetailField label="ZIP Code" value={user.zipCode || "—"} />
                    </div>
                  </div>
                ) : cfg.isContractor ? (
                  <div className="space-y-5">
                    <DetailField label="Address" value={user.address || "—"} />
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailField label="City" value={user.city || "—"} />
                      <DetailField label="State" value={user.state || "—"} />
                      <DetailField label="Country" value={user.country || "—"} />
                      <DetailField label="ZIP Code" value={user.zipCode || "—"} />
                    </div>
                  </div>
                ) : null}
                {mode === "user" ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <DetailField
                      label="Status"
                      value={
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(user.isActive)}`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {cfg.isOperative ? (
              <div className="card-elevated space-y-5 p-4 sm:p-6">
                <h3 className="font-display font-semibold">Workforce</h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <DetailField label="Trade" value={user.tradeName || "—"} />
                  <DetailField label="CIS" value={user.cisName || "—"} />
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <DetailField label="Daily rate" value={formatDailyRate(user.dailyRate)} />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="card-elevated self-start p-6">
          <h3 className="mb-4 font-display font-semibold">Account</h3>
          <dl className="space-y-3">
            <DetailMetaRow label={`${cfg.labels.entityTitle} ID`}>{user.id}</DetailMetaRow>
            <DetailMetaRow label="Created">{formatDateTime(user.createdDate)}</DetailMetaRow>
            <DetailMetaRow label="Last edited">{formatDateTime(user.editDate)}</DetailMetaRow>
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
            <h3 className="font-display text-lg font-semibold">Delete {name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">{cfg.labels.deleteConfirm}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDel(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {cfg.labels.deleteButton}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
