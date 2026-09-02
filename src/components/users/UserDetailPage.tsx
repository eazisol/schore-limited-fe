import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormPageCard } from "@/components/FormPageCard";
import {
  DetailProfileHero,
  type DetailProfileHighlight,
} from "@/components/DetailProfileHero";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { UserFormFields } from "@/components/users/UserFormFields";
import {
  CustomerCostBudgetCard,
  CustomerRunningTasksCard,
} from "@/components/users/CustomerDetailExtras";
import { EntityHierarchyCard } from "@/components/hierarchy/EntityHierarchyCard";
import { displayUserName } from "@/components/users/UsersListPage";
import { CodeBadge, CodeWithLabel } from "@/components/CodeBadge";
import {
  resolveProfileImageUrl,
  usersService,
  toDateInputValue,
} from "@/lib/api/services/users";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { formatDailyRate, formatDetailAddress, formatDateTime, namesLookSimilar } from "@/lib/module-ui";
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
  const user = userQuery.data;

  const resolvedRoleId =
    user?.roleIds?.[0] ?? "";

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
      isDailyRate: user?.isDailyRate ?? false,
      contactName: user?.contactName ?? "",
      companyName: user?.companyName ?? "",
      clientCode: user?.clientCode ?? "",
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
    if (!user) return;
    form.reset(defaults);
  }, [user, defaults, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toUpdateUserPayload>) =>
      usersService.update(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || `${cfg.labels.entityTitle} updated`);
      queryClient.setQueryData([...cfg.queryKey, id], res.data);
      queryClient.invalidateQueries({ queryKey: cfg.queryKey });
      navigate({ to: cfg.listPath });
    },
    onError: (err) => notifyApiError(err, `Failed to update ${cfg.labels.entity}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersService.remove(id),
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
  const profileImageUrl = resolveProfileImageUrl(user.profileImagePath, user.editDate);
  const roleLabel = (user.roleNames ?? []).filter(Boolean).join(", ") || "—";
  const name = displayUserName(user);

  const profileHeroNameText = cfg.isContractor
    ? user.companyName?.trim() || name
    : cfg.isCustomer
      ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.username?.trim() ||
        "Client"
      : name;

  const profileHeroName = cfg.isCustomer
    ? <CodeWithLabel code={user.clientCode} label={profileHeroNameText} />
    : profileHeroNameText;

  const contactPersonName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  const profileHeroSubtitle = cfg.isContractor
    ? (() => {
        if (!contactPersonName) return undefined;
        if (namesLookSimilar(profileHeroNameText, contactPersonName)) return undefined;
        return `Contact: ${contactPersonName}`;
      })()
    : cfg.isOperative
      ? user.tradeName?.trim() || undefined
      : cfg.isCustomer
        ? user.contractorName?.trim() || undefined
        : mode === "user"
          ? undefined
          : roleLabel !== "—"
            ? roleLabel
            : undefined;

  const profileHeroHighlights = ((): DetailProfileHighlight[] | undefined => {
    if (cfg.isOperative) {
      return [
        { label: "Daily rate", value: formatDailyRate(user.dailyRate) },
        { label: "CIS", value: user.cisName?.trim() || "—" },
        { label: "Is daily rate", value: user.isDailyRate ? "Yes" : "No" },
      ];
    }
    if (mode === "user") {
      const items: DetailProfileHighlight[] = [];
      const loginUsername = user.username?.trim();
      const accountEmail = user.email?.trim();
      if (roleLabel !== "—") items.push({ label: "Role", value: roleLabel });
      if (
        loginUsername &&
        loginUsername.toLowerCase() !== accountEmail?.toLowerCase() &&
        !loginUsername.includes("@")
      ) {
        items.push({ label: "Username", value: loginUsername });
      }
      if (user.createdDate) {
        items.push({ label: "Member since", value: formatDateTime(user.createdDate) });
      }
      return items.length ? items : undefined;
    }
    return undefined;
  })();

  const profileHeroLocation = (() => {
    if (!cfg.isContractor && !cfg.isCustomer) return undefined;
    const address = formatDetailAddress(user);
    return address === "—" ? undefined : address;
  })();

  const profileDateOfBirth =
    !cfg.isContractor && !cfg.isCustomer
      ? toDateInputValue(user.dateOfBirth) || undefined
      : undefined;

  const profileJoiningDate =
    cfg.isOperative ? toDateInputValue(user.startDate) || undefined : undefined;

  return (
    <div className="space-y-6">
      {isEditing ? (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Form form={form} onSubmit={save} className="lg:col-span-2">
            <FormPageCard
              title={cfg.labels.editTitle}
              back={{ to: cfg.listPath, label: cfg.labels.backLabel }}
              headerActions={<SwitchField<UserFormValues> name="isActive" label="Active" />}
              maxWidth="w-full max-w-none"
              footer={
                <>
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
                    <SubmitButton size="sm" disabled={!dirty} loadingText="Saving…">
                      Save changes
                    </SubmitButton>
                  </div>
                </>
              }
            >
              <UserFormFields
                embedded
                mode={mode}
                variant="edit"
                disabled={updateMutation.isPending}
                roleSelectedLabel={user.roleNames?.[0]}
                operativeSelectedLabels={{
                  trade: user.tradeName,
                  cis: user.cisName,
                }}
                contractorSelectedLabel={user.contractorName}
              />
            </FormPageCard>
          </Form>

        {cfg.isCustomer ? <CustomerCostBudgetCard customerId={id} /> : null}
      </div>
      ) : (
        <>
          <DetailProfileHero
            className="w-full"
            title={cfg.labels.viewTitle}
            backLabel={cfg.labels.backLabel}
            backTo={cfg.listPath}
            headerActions={
              <>
                {canModify && (
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
            name={profileHeroName}
            subtitle={profileHeroSubtitle}
            imageUrl={profileImageUrl || undefined}
            imageAlt={`${cfg.labels.entityTitle} profile`}
            status={<ActiveStatusBadge isActive={user.isActive} />}
            email={user.email}
            phone={user.phone}
            dateOfBirth={profileDateOfBirth}
            joiningDate={profileJoiningDate}
            location={profileHeroLocation}
            highlights={profileHeroHighlights}
          />

          {cfg.isCustomer ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
              <div className="min-w-0 space-y-6 lg:col-span-2">
                <EntityHierarchyCard scope="customer" customerId={id} />
                <CustomerRunningTasksCard customerId={id} />
              </div>
              <div className="self-start">
                <CustomerCostBudgetCard customerId={id} />
              </div>
            </div>
          ) : null}
        </>
      )}

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
