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
import { UserFormFields, OPERATIVE_FORM_TABS, type OperativeFormTab } from "@/components/users/UserFormFields";
import { OperativeDetailExtras } from "@/components/users/OperativeDetailExtras";
import { CustomerDetailExtrasPanel } from "@/components/users/CustomerDetailPanels";
import { UserDetailExtras } from "@/components/users/UserDetailExtras";
import { ClientEditModal } from "@/components/hierarchy/ClientEditModal";
import { displayUserName } from "@/components/users/UsersListPage";
import {
  resolveProfileImageUrl,
  usersService,
  toDateInputValue,
} from "@/lib/api/services/users";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { formatDailyRate, formatDetailAddress, formatDateTime, namesLookSimilar } from "@/lib/module-ui";
import { formatUkDate } from "@/lib/week-ending";
import { formatSortCodeInput } from "@/lib/user-form";
import { useUserModuleMode, userModuleConfig } from "@/lib/user-module";
import { useAuth } from "@/contexts/AuthContext";
import {
  PERMISSION_UPDATED_STORAGE_KEY,
  usePermissions,
} from "@/contexts/PermissionContext";
import {
  editUserFormSchema,
  emptyUserFormValues,
  toUpdateUserPayload,
  userToFormValues,
  type UserFormValues,
} from "@/lib/user-form";
import { uploadPendingCertificationFiles } from "@/lib/upload-certification-files";
import { useRateCapReasonGate } from "@/components/rates/useRateCapReasonGate";
import { cn } from "@/lib/utils";

export function UserDetailPage() {
  const mode = useUserModuleMode();
  const cfg = userModuleConfig(mode);
  const params = useParams({ strict: false }) as { id?: string };
  const search = useSearch({ strict: false }) as { mode?: "edit" | "view"; tab?: OperativeFormTab };
  const id = String(params.id ?? "");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: sessionUser } = useAuth();
  const { refreshPermissions } = usePermissions();
  const canModify = usePermission({ route: cfg.permissionRoute, action: "modify" });
  const canDelete = usePermission({ route: cfg.permissionRoute, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [operativeTab, setOperativeTab] = useState<OperativeFormTab>(search.tab ?? "details");
  const { runWithCapReason, modal: capReasonModal } = useRateCapReasonGate();
  const isEditing = !cfg.isCustomer && search.mode === "edit" && canModify;
  const schema = editUserFormSchema(mode);
  const isOperative = mode === "operative";
  const operativeTabIndex = OPERATIVE_FORM_TABS.findIndex((item) => item.id === operativeTab);
  const canGoPrevious = isOperative && isEditing && operativeTabIndex > 0;
  const canGoNext =
    isOperative && isEditing && operativeTabIndex >= 0 && operativeTabIndex < OPERATIVE_FORM_TABS.length - 1;

  useEffect(() => {
    if (search.tab) {
      setOperativeTab(search.tab);
    }
  }, [search.tab]);

  useEffect(() => {
    if (!cfg.isCustomer || !canModify || search.mode !== "edit" || !id) return;
    setClientEditOpen(true);
    navigate({
      to: cfg.detailPath,
      params: { id },
      search: {},
      replace: true,
    });
  }, [canModify, cfg.detailPath, cfg.isCustomer, id, navigate, search.mode]);

  function openEdit(targetTab?: OperativeFormTab) {
    if (cfg.isCustomer) {
      setClientEditOpen(true);
      return;
    }
    if (targetTab) {
      setOperativeTab(targetTab);
    }
    navigate({
      to: cfg.detailPath,
      params: { id },
      search: {
        mode: "edit",
        ...(targetTab ? { tab: targetTab } : {}),
      },
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

  const defaults = useMemo<UserFormValues>(
    () => (user ? userToFormValues(user) : emptyUserFormValues),
    [user],
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
    mutationFn: async (values: UserFormValues) => {
      const res = await usersService.update(id, toUpdateUserPayload(values, mode));
      if (mode === "operative" && res.data?.id) {
        await uploadPendingCertificationFiles(String(res.data.id), values.certifications, res.data);
      }
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message || `${cfg.labels.entityTitle} updated`);
      queryClient.setQueryData([...cfg.queryKey, id], res.data);
      queryClient.invalidateQueries({ queryKey: cfg.queryKey });
      if (mode === "user" && sessionUser?.id === id) {
        window.localStorage.setItem(PERMISSION_UPDATED_STORAGE_KEY, String(Date.now()));
        void refreshPermissions();
      }
      openView();
    },
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
    try {
      await runWithCapReason(values, (next) => updateMutation.mutateAsync(next));
    } catch (err) {
      notifyApiError(err, `Failed to update ${cfg.labels.entity}`);
    }
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
        ...(user.isDailyRate
          ? [{ label: "Is daily rate", value: "Yes" } satisfies DetailProfileHighlight]
          : []),
        {
          label: "Bank",
          value: user.bankName?.trim()
            || user.accountHolderName?.trim()
            || (user.sortCode && user.accountNumber
              ? `${formatSortCodeInput(user.sortCode)} / ${user.accountNumber.replace(/\D/g, "")}`
              : "—"),
        },
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
      ? (() => {
          const raw = toDateInputValue(user.dateOfBirth);
          return raw ? formatUkDate(raw) : undefined;
        })()
      : undefined;

  const profileJoiningDate =
    cfg.isOperative
      ? (() => {
          const raw = toDateInputValue(user.startDate);
          return raw ? formatUkDate(raw) : undefined;
        })()
      : undefined;

  return (
    <div className="space-y-6">
      {isEditing ? (
        <Form form={form} onSubmit={save} className="w-full max-w-3xl">
          <FormPageCard
            title={cfg.labels.editTitle}
            onBack={{ label: "Back to details", onClick: openView }}
            headerActions={<SwitchField<UserFormValues> name="isActive" label="Active" />}
            maxWidth="w-full max-w-3xl"
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
                  {canGoPrevious ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() => setOperativeTab(OPERATIVE_FORM_TABS[operativeTabIndex - 1]!.id)}
                    >
                      Previous
                    </Button>
                  ) : null}
                  {canGoNext ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() => setOperativeTab(OPERATIVE_FORM_TABS[operativeTabIndex + 1]!.id)}
                    >
                      Next
                    </Button>
                  ) : null}
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
                trades: (() => {
                  const ids = user.tradeIds?.length
                    ? user.tradeIds
                    : user.tradeId != null
                      ? [String(user.tradeId)]
                      : [];
                  const names = user.tradeNames?.length
                    ? user.tradeNames
                    : user.tradeName
                      ? user.tradeName.split(",").map((n) => n.trim())
                      : [];
                  const map: Record<string, string> = {};
                  ids.forEach((id, i) => {
                    map[String(id)] = names[i] ?? String(id);
                  });
                  return map;
                })(),
                cis: user.cisName,
              }}
              contractorSelectedLabel={user.contractorName}
              capabilityResetKey={id}
              operativeTab={isOperative ? operativeTab : undefined}
              onOperativeTabChange={isOperative ? setOperativeTab : undefined}
            />
          </FormPageCard>
        </Form>
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
            name={profileHeroNameText}
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

          {cfg.isOperative ? (
            <OperativeDetailExtras
              user={user}
              canEdit={canModify}
              onEdit={openEdit}
            />
          ) : null}

          {mode === "user" ? (
            <UserDetailExtras
              user={user}
              canEdit={canModify}
              onEdit={openEdit}
            />
          ) : null}

          {cfg.isCustomer ? (
            <CustomerDetailExtrasPanel
              user={user}
              customerId={id}
              customerLabel={profileHeroNameText}
              onAddRates={canModify ? () => setClientEditOpen(true) : undefined}
            />
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

      {cfg.isCustomer && clientEditOpen ? (
        <ClientEditModal
          customerId={id}
          onClose={() => {
            setClientEditOpen(false);
            queryClient.invalidateQueries({ queryKey: [...cfg.queryKey, id] });
          }}
        />
      ) : null}

      {capReasonModal}
    </div>
  );
}
