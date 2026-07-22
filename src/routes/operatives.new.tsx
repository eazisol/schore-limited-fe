import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  TextField,
  SelectField,
  CheckboxField,
  SubmitButton,
  PhoneNumberField,
} from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { operativesService, type OperativePayload } from "@/lib/api/services/operatives";
import { tradesService } from "@/lib/api/services/trades";
import { cisService } from "@/lib/api/services/cis";
import { notifyApiError } from "@/lib/api/axios";
import { operativesQueryKey } from "./operatives.index";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { formatCisRate } from "@/lib/module-ui";

const OPERATIVES_ROUTE = "/operatives";

export const Route = createFileRoute("/operatives/new")({
  head: () => ({ meta: [{ title: "Add Operative | Schore" }] }),
  component: NewOperative,
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
      ctx.addIssue({
        code: "custom",
        path: ["utr"],
        message: "UTR must be 10 digits",
      });
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

function NewOperative() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tradesQuery = useQuery({
    queryKey: ["trades", "options"],
    queryFn: async () => (await tradesService.options()).data,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const cisQuery = useQuery({
    queryKey: ["cis", "options"],
    queryFn: async () => (await cisService.options()).data,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const defaultCis =
    cisQuery.data?.find((c) => c.isDefault) ??
    cisQuery.data?.find((c) => c.rate === 20) ??
    cisQuery.data?.[0];

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      tradeId: "",
      cisRate: defaultCis ? String(defaultCis.rate) : "20",
      dailyRate: 240,
      phone: "",
      email: "",
      utr: "",
      emergencyContact: "",
      startDate: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: OperativePayload) => operativesService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || `${res.data?.name || "Operative"} created`);
      queryClient.invalidateQueries({ queryKey: operativesQueryKey });
      navigate({ to: "/operatives" });
    },
    onError: (err) => notifyApiError(err, "Failed to create operative"),
  });

  async function submit(values: Values) {
    const trade = (tradesQuery.data ?? []).find((t) => String(t.id) === values.tradeId);
    if (!trade) {
      toast.error("Please fill all required fields.");
      return;
    }
    await createMutation.mutateAsync({
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

  const lookupsLoading = tradesQuery.isLoading || cisQuery.isLoading;
  const cisRate = form.watch("cisRate");

  return (
    <RequirePermission route={OPERATIVES_ROUTE} action="modify">
      <div>
        <PageHeader
          title="Add Operative"
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
        />

        <Form form={form} onSubmit={submit} className="max-w-3xl space-y-6">
          <Section title="Identity" hint="Typing this name later auto-loads the trade on allocation.">
            <TextField<Values> name="name" label="Full name" required autoFocus maxLength={100} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField<Values>
                name="tradeId"
                label="Trade"
                required
                placeholder="Select trade"
                disabled={lookupsLoading}
                options={(tradesQuery.data ?? []).map((t) => ({
                  value: String(t.id),
                  label: t.name,
                }))}
              />
              <TextField<Values> name="startDate" label="Start date" type="date" />
            </div>
          </Section>

          <Section title="Payroll" hint="CIS rate drives the deduction on every wage sheet.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SelectField<Values>
                name="cisRate"
                label="CIS status"
                required
                placeholder="Select CIS"
                disabled={lookupsLoading}
                options={(cisQuery.data ?? []).map((c) => ({
                  value: String(c.rate),
                  label: `${c.name} (${formatCisRate(c.rate)})`,
                }))}
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
                placeholder="10-digit UTR"
              />
            </div>
          </Section>

          <Section title="Contact" hint="Optional. Used for sending wage statements.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PhoneNumberField<Values> name="phone" label="Phone" placeholder="07700 900000" />
              <TextField<Values> name="email" label="Email" type="email" placeholder="name@email.com" />
            </div>
            <TextField<Values>
              name="emergencyContact"
              label="Emergency contact"
              maxLength={150}
              placeholder="Name + phone"
            />
            <CheckboxField<Values>
              name="isActive"
              label="Active"
              description="Operative can be allocated to properties."
            />
          </Section>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/operatives" })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton loadingText="Saving…" disabled={lookupsLoading}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create operative
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
    <div className="card-elevated space-y-4 p-6">
      <div>
        <h3 className="font-display font-semibold">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
