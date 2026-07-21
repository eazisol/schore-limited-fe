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
} from "@/components/form";
import { Can, usePermission } from "@/components/Permission";
import { operativesService, type OperativePayload } from "@/lib/api/services/operatives";
import { tradesService } from "@/lib/api/services/trades";
import { cisService } from "@/lib/api/services/cis";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { operativesQueryKey } from "./operatives.index";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { activeStatusClass, formatCisRate, formatDateTime, formatGbp } from "@/lib/module-ui";

const OPERATIVES_ROUTE = "/operatives";

const detailSearchSchema = z.object({
  mode: z.enum(["edit", "view"]).optional(),
});

export const Route = createFileRoute("/operatives/$id")({
  head: ({ params }) => ({ meta: [{ title: `Operative #${params.id} | Schore` }] }),
  validateSearch: detailSearchSchema,
  component: OperativeDetail,
});

function validatePhoneNumber(value: string) {
  if (!value.trim()) return true;
  return !getPhoneLengthError(value.trim(), undefined, { requireMin: true });
}

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be 100 characters or fewer"),
    tradeId: z.string().min(1, "Trade is required"),
    cisRate: z.string().min(1, "CIS status is required"),
    dailyRate: z.coerce.number().positive("Daily rate must be greater than 0"),
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
    email: z
      .string()
      .trim()
      .superRefine((v, ctx) => {
        if (!v) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          ctx.addIssue({ code: "custom", message: "Enter a valid email address" });
        }
      }),
    utr: z.string().trim(),
    emergencyContact: z.string().trim().max(150, "Emergency contact must be 150 characters or fewer"),
    startDate: z.string().trim(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const rate = Number(values.cisRate);
    if (rate !== 0 && values.utr && !/^\d{10}$/.test(values.utr)) {
      ctx.addIssue({ code: "custom", path: ["utr"], message: "UTR must be 10 digits" });
    }
    if (rate !== 0 && !values.utr) {
      ctx.addIssue({
        code: "custom",
        path: ["utr"],
        message: "UTR is required for 20%/30% CIS",
      });
    }
  });
type Values = z.infer<typeof schema>;

function OperativeDetail() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: OPERATIVES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: OPERATIVES_ROUTE, action: "delete" });
  const [confirmDel, setConfirmDel] = useState(false);
  const isEditing = mode === "edit" && canModify;

  function openEdit() {
    navigate({
      to: "/operatives/$id",
      params: { id },
      search: { mode: "edit" },
      replace: true,
    });
  }

  function openView() {
    navigate({
      to: "/operatives/$id",
      params: { id },
      search: {},
      replace: true,
    });
  }

  const operativeQuery = useQuery({
    queryKey: ["operatives", id],
    queryFn: async () => (await operativesService.get(id)).data,
  });
  const tradesQuery = useQuery({
    queryKey: ["trades", "options"],
    queryFn: async () => (await tradesService.options()).data,
  });
  const cisQuery = useQuery({
    queryKey: ["cis", "options"],
    queryFn: async () => (await cisService.options()).data,
  });

  const operative = operativeQuery.data;
  const trades = tradesQuery.data ?? [];
  const cisOptions = cisQuery.data ?? [];
  const lookupsReady = tradesQuery.isSuccess && cisQuery.isSuccess;

  const tradeOptions = useMemo(() => {
    const options = trades.map((t) => ({ value: String(t.id), label: t.name }));
    if (
      operative?.tradeId != null &&
      !options.some((o) => o.value === String(operative.tradeId))
    ) {
      options.unshift({
        value: String(operative.tradeId),
        label: operative.tradeName || `Trade #${operative.tradeId}`,
      });
    }
    return options;
  }, [trades, operative?.tradeId, operative?.tradeName]);

  const cisSelectOptions = useMemo(() => {
    const options = cisOptions.map((c) => ({
      value: String(c.rate),
      label: `${c.name} (${formatCisRate(c.rate)})`,
    }));
    if (
      operative &&
      !options.some((o) => o.value === String(operative.cisRate))
    ) {
      options.unshift({
        value: String(operative.cisRate),
        label: formatCisRate(operative.cisRate),
      });
    }
    return options;
  }, [cisOptions, operative]);

  const defaults = useMemo<Values>(
    () => ({
      name: operative?.name ?? "",
      tradeId: operative?.tradeId != null ? String(operative.tradeId) : "",
      cisRate: operative != null ? String(operative.cisRate) : "",
      dailyRate: operative?.dailyRate ?? 0,
      phone: operative?.phone ?? "",
      email: operative?.email ?? "",
      utr: operative?.utr ?? "",
      emergencyContact: operative?.emergencyContact ?? "",
      startDate: operative?.startDate ?? "",
      isActive: operative?.isActive ?? true,
    }),
    [operative],
  );

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => {
    if (!operative || !lookupsReady) return;
    form.reset(defaults);
  }, [operative, defaults, form, lookupsReady]);

  const updateMutation = useMutation({
    mutationFn: (payload: OperativePayload) => operativesService.update(numericId, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Operative updated");
      queryClient.setQueryData(["operatives", id], res.data);
      queryClient.invalidateQueries({ queryKey: operativesQueryKey });
      navigate({ to: "/operatives" });
    },
    onError: (err) => notifyApiError(err, "Failed to update operative"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => operativesService.remove(numericId),
    onSuccess: (res) => {
      toast.success(res.message || "Operative deleted");
      queryClient.invalidateQueries({ queryKey: operativesQueryKey });
      navigate({ to: "/operatives" });
    },
    onError: (err) => notifyApiError(err, "Failed to delete operative"),
  });

  async function save(values: Values) {
    const trade =
      trades.find((t) => String(t.id) === values.tradeId) ??
      (operative?.tradeId != null && String(operative.tradeId) === values.tradeId
        ? { id: operative.tradeId, name: operative.tradeName }
        : null);
    if (!trade) {
      toast.error("Please fill all required fields.");
      return;
    }
    await updateMutation.mutateAsync({
      name: values.name.trim(),
      tradeId: trade.id,
      tradeName: trade.name,
      cisRate: Number(values.cisRate),
      dailyRate: values.dailyRate,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      utr: values.utr.trim() || null,
      emergencyContact: values.emergencyContact.trim() || null,
      startDate: values.startDate.trim() || null,
      isActive: values.isActive,
    });
  }

  if (operativeQuery.isLoading) {
    return (
      <div className="card-elevated grid place-items-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" />
        Loading operative…
      </div>
    );
  }

  if (operativeQuery.isError || !operative) {
    return (
      <div className="card-elevated p-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
        <h2 className="font-display text-lg font-semibold">Unable to load operative</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(operativeQuery.error as unknown as ApiError)?.message ||
            "This operative may have been deleted."}
        </p>
        <Button className="mt-4" asChild>
          <Link to="/operatives">Back to operatives</Link>
        </Button>
      </div>
    );
  }

  const dirty = form.formState.isDirty;
  const lookupsLoading = tradesQuery.isLoading || cisQuery.isLoading;
  const cisRate = form.watch("cisRate");

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? "Edit operative" : "Operative details"}
        leading={
          <AppTooltip content="Back to operatives" asChild>
            <Link
              to="/operatives"
              aria-label="Back to operatives"
              className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </AppTooltip>
        }
        actions={
          <>
            {!isEditing && canModify && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
                Edit operative
              </Button>
            )}
            <Can route={OPERATIVES_ROUTE} action="delete">
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
              <TextField<Values> name="name" label="Full name" required maxLength={100} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField<Values>
                  name="tradeId"
                  label="Trade"
                  required
                  placeholder={lookupsReady ? "Select trade" : "Loading trades…"}
                  disabled={lookupsLoading || !lookupsReady}
                  options={tradeOptions}
                />
                <TextField<Values> name="startDate" label="Start date" type="date" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SelectField<Values>
                  name="cisRate"
                  label="CIS status"
                  required
                  placeholder={lookupsReady ? "Select CIS" : "Loading…"}
                  disabled={lookupsLoading || !lookupsReady}
                  options={cisSelectOptions}
                />
                <TextField<Values>
                  name="dailyRate"
                  label="Daily rate (£)"
                  required
                  type="number"
                  min={1}
                  step="1"
                />
                <TextField<Values>
                  name="utr"
                  label="UTR"
                  required={cisRate !== "0"}
                  maxLength={10}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PhoneNumberField<Values> name="phone" label="Phone" placeholder="07700 900000" />
                <TextField<Values> name="email" label="Email" type="email" />
              </div>
              <TextField<Values>
                name="emergencyContact"
                label="Emergency contact"
                maxLength={150}
              />
              <CheckboxField<Values>
                name="isActive"
                label="Active"
                description="Operative can be allocated to properties."
              />
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
            <h3 className="font-display font-semibold">Profile</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="Full name" value={operative.name} />
                <ReadOnlyField label="Trade" value={operative.tradeName} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="CIS" value={formatCisRate(operative.cisRate)} />
                <ReadOnlyField label="Daily rate" value={formatGbp(operative.dailyRate)} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="UTR" value={operative.utr || "—"} />
                <ReadOnlyField label="Start date" value={operative.startDate || "—"} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="Phone" value={operative.phone || "—"} />
                <ReadOnlyField label="Email" value={operative.email || "—"} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField
                  label="Emergency contact"
                  value={operative.emergencyContact || "—"}
                />
                <ReadOnlyField
                  label="Status"
                  value={
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeStatusClass(operative.isActive)}`}
                    >
                      {operative.isActive ? "Active" : "Inactive"}
                    </span>
                  }
                />
              </div>
            </div>
          </div>
        )}

        <div className="card-elevated self-start p-6">
          <h3 className="mb-4 font-display font-semibold">Record</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Operative ID">{operative.id}</Row>
            <Row label="Created">{formatDateTime(operative.createdDate)}</Row>
            <Row label="Last edited">{formatDateTime(operative.editDate)}</Row>
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
            <h3 className="font-display text-lg font-semibold">Delete {operative.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes the operative from the workforce builder. Past wage sheets are kept for
              audit.
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
                Delete operative
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
      <div className="break-words text-sm font-medium">{value}</div>
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
