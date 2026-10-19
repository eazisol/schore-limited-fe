import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { SignaturePadModal } from "@/components/wages/SignaturePadModal";
import { ArrowLeft, Send, Check, X, Banknote, Loader2, MessageSquare, CalendarDays, User } from "lucide-react";
import { toast } from "sonner";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/components/Permission";
import { usePermissions } from "@/contexts/PermissionContext";
import { isOperativePortalUser } from "@/lib/operative-portal";
import { payStatementsService, type ApiPayStatementDetail, type ApiPayStatementDay } from "@/lib/api/services/pay-statements";
import type { BrandingSettings } from "@/lib/api/services/settings";
import { useCompanyBranding } from "@/lib/branding";
import {
  formatUkDate,
  formatWageSheetDayMonth,
  formatWageWeekRange,
  invoiceNo,
} from "@/lib/week-ending";
import { payStatementsQueryKey } from "./payroll";

type SignatureSlot = "sender" | "operative";

/** Fallback only when branding has never been configured. */
const BRANDING_FALLBACK = {
  companyName: "Schore Limited",
  address: "Unit E, The Business Center, Faringdon Avenue,",
  city: "Romford",
  state: "Essex",
  zipCode: "RM3 8EN",
  phone: "07982138777",
  email: "office@schore.co.uk",
  website: "",
} as const;

function resolveWageBranding(raw: BrandingSettings | null | undefined) {
  const configured = Boolean(raw?.companyName?.trim());
  const companyName = raw?.companyName?.trim() || BRANDING_FALLBACK.companyName;
  const address = raw?.address?.trim() || (configured ? "" : BRANDING_FALLBACK.address);
  const city = raw?.city?.trim() || (configured ? "" : BRANDING_FALLBACK.city);
  const state = raw?.state?.trim() || (configured ? "" : BRANDING_FALLBACK.state);
  const zipCode = raw?.zipCode?.trim() || (configured ? "" : BRANDING_FALLBACK.zipCode);
  const country = raw?.country?.trim() || "";
  const phone = raw?.phone?.trim() || (configured ? "" : BRANDING_FALLBACK.phone);
  const email = raw?.email?.trim() || (configured ? "" : BRANDING_FALLBACK.email);
  const website = raw?.website?.trim() || "";

  const locality = [city, state, zipCode, country].filter(Boolean).join(", ");
  const contact = [phone, email, website].filter(Boolean).join(" · ");

  return {
    companyName,
    companyNameUpper: companyName.toUpperCase(),
    address,
    locality,
    contact,
  };
}

/** Plain amount for tables when £ / % sits on the heading. */
function fmtAmount(n: number) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
const wageDetailSearchSchema = z.object({
  from: z.enum(["payroll", "operative", "operative-me", "reports-wages"]).optional(),
  operativeId: z.string().optional(),
  weekEnding: z.string().optional(),
});

export const Route = createFileRoute("/wages/$id")({
  validateSearch: wageDetailSearchSchema,
  head: () => ({ meta: [{ title: "Wage Sheet | Schore" }] }),
  notFoundComponent: () => (
    <div className="card-elevated p-12 text-center">
      <h2 className="font-display font-semibold">Wage sheet not found</h2>
      <Button className="mt-4" asChild>
        <Link to="/wages">All wage sheets</Link>
      </Button>
    </div>
  ),
  component: WageSheetView,
});

type WageBackLink = {
  to: "/payroll" | "/wages" | "/operatives/$id" | "/operatives/me" | "/reports/wages";
  params?: { id: string };
  search?: { weekEnding?: string; viewTab?: "wages" };
  label: string;
};

function wageBackLink(search: z.infer<typeof wageDetailSearchSchema>): WageBackLink {
  if (search.from === "payroll") {
    return { to: "/payroll", label: "Back to payroll" };
  }
  if (search.from === "operative-me") {
    return {
      to: "/operatives/me",
      label: "Back to operative",
      search: { viewTab: "wages" },
    };
  }
  if (search.from === "operative" && search.operativeId) {
    return {
      to: "/operatives/$id",
      params: { id: search.operativeId },
      label: "Back to operative",
      search: { viewTab: "wages" },
    };
  }
  if (search.from === "reports-wages") {
    return { to: "/reports/wages", label: "Back to wages report" };
  }
  return {
    to: "/wages",
    search: search.weekEnding ? { weekEnding: search.weekEnding } : undefined,
    label: "All wage sheets",
  };
}

function WageSheetView() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const back = wageBackLink(search);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { menus } = usePermissions();
  const isPortal = isOperativePortalUser(user?.userTypeCode, menus);
  const wagesRead = usePermission({ pathname: "/wages", action: "read" });
  const payrollRead = usePermission({ pathname: "/payroll", action: "read" });
  const statementsRead = usePermission({ pathname: "/statements", action: "read" });
  const wagesModify = usePermission({ pathname: "/wages", action: "modify" });
  const payrollModify = usePermission({ pathname: "/payroll", action: "modify" });
  const statementsModify = usePermission({ pathname: "/statements", action: "modify" });
  const isOffice = !isPortal && (wagesRead || payrollRead || statementsRead);
  const canModify = !isPortal && (wagesModify || payrollModify || statementsModify);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [paidOpen, setPaidOpen] = useState(false);
  const [signatureSlot, setSignatureSlot] = useState<SignatureSlot | null>(null);

  const query = useQuery({
    queryKey: [...payStatementsQueryKey, "detail", id, isOffice ? "office" : "mine"],
    queryFn: async () => {
      if (isOffice) {
        return (await payStatementsService.get(id)).data;
      }
      return (await payStatementsService.getMine(id)).data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: payStatementsQueryKey });
  };

  const sendMutation = useMutation({
    mutationFn: () => payStatementsService.send(id),
    onSuccess: (res) => {
      toast.success(res.message || "Statement sent");
      setConfirmSend(false);
      invalidate();
    },
    onError: (err) => notifyApiError(err, "Failed to send statement"),
  });
  const resendMutation = useMutation({
    mutationFn: () => payStatementsService.resend(id),
    onSuccess: (res) => {
      toast.success(res.message || "Statement resent");
      setConfirmResend(false);
      invalidate();
    },
    onError: (err) => notifyApiError(err, "Failed to resend statement"),
  });
  const respondMutation = useMutation({
    mutationFn: (payload: { accepted: boolean; reason?: string }) =>
      payStatementsService.respond(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Response saved");
      setRefuseOpen(false);
      setRefuseReason("");
      invalidate();
    },
    onError: (err) => notifyApiError(err, "Failed to respond"),
  });
  const paidMutation = useMutation({
    mutationFn: () => payStatementsService.markPaid(id, { paidNote }),
    onSuccess: (res) => {
      toast.success(res.message || "Marked paid");
      setPaidOpen(false);
      setPaidNote("");
      invalidate();
    },
    onError: (err) => notifyApiError(err, "Failed to mark paid"),
  });
  const saveSignatureMutation = useMutation({
    mutationFn: ({ slot, dataUrl }: { slot: SignatureSlot; dataUrl: string }) =>
      slot === "sender"
        ? payStatementsService.saveSenderSignature(id, dataUrl)
        : payStatementsService.saveOperativeSignature(id, dataUrl),
    onSuccess: (res) => {
      toast.success(res.message || "Signature saved");
      setSignatureSlot(null);
      invalidate();
    },
    onError: (err) => notifyApiError(err, "Failed to save signature"),
  });
  const clearSignatureMutation = useMutation({
    mutationFn: (slot: SignatureSlot) =>
      slot === "sender"
        ? payStatementsService.clearSenderSignature(id)
        : payStatementsService.clearOperativeSignature(id),
    onSuccess: (res) => {
      toast.success(res.message || "Signature removed");
      setSignatureSlot(null);
      invalidate();
    },
    onError: (err) => notifyApiError(err, "Failed to remove signature"),
  });

  const w = query.data;
  const isOwner = w != null && user?.id === w.operativeId;
  const canSend = canModify && (w?.statusCode === "DRAFT" || w?.statusCode === "REFUSED");
  const canResend = canModify && w?.statusCode === "SENT";
  const canRespond = isOwner && w?.statusCode === "SENT";
  const canMarkPaid = canModify && w?.statusCode === "ACCEPTED" && w.paymentStatusCode !== "PAID";
  /** Office may add/edit/delete left signature only while Draft or Refused. */
  const canEditSenderSignature =
    canModify && (w?.statusCode === "DRAFT" || w?.statusCode === "REFUSED");
  /** Only the operative may add/edit/delete right signature while Sent. */
  const canEditOperativeSignature = isOwner && w?.statusCode === "SENT";
  const hasSenderSignature = Boolean(w?.senderSignatureData?.trim());
  const hasOperativeSignature = Boolean(w?.operativeSignatureData?.trim());

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading wage sheet…
      </div>
    );
  }

  if (query.isError || !w) {
    const err = query.error as unknown as ApiError | undefined;
    return (
      <div className="card-elevated p-12 text-center">
        <h2 className="font-display font-semibold">Wage sheet not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {err?.message ?? "This statement is not available."}
        </p>
        <Button className="mt-4" asChild>
          <Link to={back.to} params={back.params} search={back.search}>
            Back
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-3">
      <PageHeader
        title={`Wage Sheet · ${invoiceNo(w.invoiceNumber)}`}
        leading={
          <AppTooltip content={back.label} asChild>
            <Link
              to={back.to}
              params={back.params}
              search={back.search}
              aria-label={back.label}
              className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </AppTooltip>
        }
        actions={
          <>
            <StatusBadge status={w.statusName} />
            <StatusBadge status={w.paymentStatusName} />
            {canSend && (
              <Button size="sm" onClick={() => setConfirmSend(true)}>
                <Send className="h-3.5 w-3.5" />
                Send to operative
              </Button>
            )}
            {canResend && (
              <Button size="sm" variant="outline" onClick={() => setConfirmResend(true)}>
                <Send className="h-3.5 w-3.5" />
                Resend to operative
              </Button>
            )}
            {canRespond && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-destructive"
                  onClick={() => setRefuseOpen(true)}
                >
                  <X className="h-3.5 w-3.5" />
                  Refuse
                </Button>
                <Button
                  size="sm"
                  onClick={() => respondMutation.mutate({ accepted: true })}
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </Button>
              </>
            )}
            {canMarkPaid && (
              <Button size="sm" onClick={() => setPaidOpen(true)}>
                <Banknote className="h-3.5 w-3.5" />
                Mark paid
              </Button>
            )}
          </>
        }
      />

      <WageSheet
        w={w}
        canEditSenderSignature={canEditSenderSignature}
        canEditOperativeSignature={canEditOperativeSignature}
        onOpenSignature={(slot) => setSignatureSlot(slot)}
      />

      {w.days.length > 0 && (
        <div className="card-elevated overflow-hidden">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">Day MAX breakdown</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Price work £</th>
                <th className="px-3 py-2 text-left">Daily rate</th>
                <th className="px-3 py-2 text-right">Top-up £</th>
                <th className="px-4 py-2 text-right">Day pay £</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {w.days.map((day: ApiPayStatementDay) => (
                <tr key={day.id}>
                  <td className="px-4 py-2">{formatUkDate(day.workDate)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtAmount(day.priceWork)}</td>
                  <td className="px-3 py-2">{day.isDailyTicked ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtAmount(day.topUp)}</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">{fmtAmount(day.dayPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(w.statusCode === "REFUSED" || w.rejectDate || w.refusalReason) && (
        <RefusalBanner
          reason={w.refusalReason}
          refusedOn={w.rejectDate}
          refusedByName={w.respondedByName}
          refusedByRole={w.respondedByUserTypeName}
        />
      )}

      {confirmSend && (
        <ConfirmDialog
          title={`Send statement to ${w.operativeName}?`}
          body="The operative will receive an email link. They must sign in to accept or refuse."
          confirmLabel="Send now"
          pending={sendMutation.isPending}
          onCancel={() => setConfirmSend(false)}
          onConfirm={() => sendMutation.mutate()}
        />
      )}

      {confirmResend && (
        <ConfirmDialog
          title={`Resend statement to ${w.operativeName}?`}
          body="The operative will receive the same email link again. Sign-off status will not change."
          confirmLabel="Resend now"
          pending={resendMutation.isPending}
          onCancel={() => setConfirmResend(false)}
          onConfirm={() => resendMutation.mutate()}
        />
      )}

      {refuseOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">Refuse this statement?</h3>
            <textarea
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              placeholder="Reason (required)"
              className="mt-3 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRefuseOpen(false)}>Cancel</Button>
              <Button
                disabled={!refuseReason.trim() || respondMutation.isPending}
                onClick={() => respondMutation.mutate({ accepted: false, reason: refuseReason.trim() })}
              >
                Refuse
              </Button>
            </div>
          </div>
        </div>
      )}

      {paidOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">Mark as paid?</h3>
            <textarea
              value={paidNote}
              onChange={(e) => setPaidNote(e.target.value)}
              placeholder="Payment note (optional)"
              className="mt-3 min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm"
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaidOpen(false)}>Cancel</Button>
              <Button disabled={paidMutation.isPending} onClick={() => paidMutation.mutate()}>
                Mark paid
              </Button>
            </div>
          </div>
        </div>
      )}

      {signatureSlot && (
        <SignaturePadModal
          open
          title={signatureSlot === "sender" ? "Office signature" : "Operative signature"}
          subtitle={
            signatureSlot === "sender"
              ? "Required before sending this wage sheet to the operative."
              : "Required before you accept this wage sheet."
          }
          initialDataUrl={
            signatureSlot === "sender" ? w.senderSignatureData : w.operativeSignatureData
          }
          pending={saveSignatureMutation.isPending}
          clearPending={clearSignatureMutation.isPending}
          canClearSaved={
            signatureSlot === "sender"
              ? canEditSenderSignature && hasSenderSignature
              : canEditOperativeSignature && hasOperativeSignature
          }
          onClose={() => setSignatureSlot(null)}
          onSave={(dataUrl) =>
            saveSignatureMutation.mutate({ slot: signatureSlot, dataUrl })
          }
          onClearSaved={() => clearSignatureMutation.mutate(signatureSlot)}
        />
      )}
    </div>
  );
}

function WageSheet({
  w,
  canEditSenderSignature,
  canEditOperativeSignature,
  onOpenSignature,
}: {
  w: ApiPayStatementDetail;
  canEditSenderSignature: boolean;
  canEditOperativeSignature: boolean;
  onOpenSignature: (slot: SignatureSlot) => void;
}) {
  const weekLabel = formatWageWeekRange(w.weekStart, w.weekEnding);
  const utrNi =
    [w.operativeUtr, w.operativeNiNumber].filter(Boolean).join(" / ") || null;
  const invoice = invoiceNo(w.invoiceNumber);
  const brandBlue = "#1e3a5f";

  const brandingQuery = useCompanyBranding();
  const brand = resolveWageBranding(brandingQuery.data);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm print:border-0 print:shadow-none">
      <div className="px-5 py-5 md:px-6 md:py-6">
        {/* Section 1 — header + info box */}
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2
              className="text-[1.6rem] font-bold uppercase tracking-tight leading-none"
              style={{ color: brandBlue }}
            >
              {brand.companyNameUpper}
            </h2>
            <span className="text-[1.1rem] font-normal text-slate-500">
              Weekly Wage Sheet
            </span>
          </div>
          <div className="mt-1.5 h-[2.5px] w-full" style={{ backgroundColor: brandBlue }} />
          <p className="mt-1 text-[13px] text-slate-500">
            Construction & Maintenance — Basildon, Essex
          </p>

          <div className="mt-3 grid gap-4 bg-[#f2f2f2] px-4 py-3 text-[14.5px] leading-snug sm:grid-cols-2 sm:gap-8">
            <div className="space-y-0.5">
              <HeaderLine label="Name" value={w.operativeName} />
              <HeaderLine label="Trade" value={w.tradeName ?? w.operativeTradeCode} />
              <HeaderLine label="Project" value={w.projectName ?? w.projectCode} />
              <HeaderLine label="Site / Contract" value={w.siteContract ?? w.customerNames} />
              <HeaderLine label="Site Manager" value={w.siteManagerName} />
              <HeaderLine label="UTR / NINO" value={utrNi} blank />
            </div>
            <div className="min-w-0 space-y-0.5">
              <HeaderLine label="Invoice No" value={invoice} blank={!invoice} />
              <HeaderLine label="Week" value={weekLabel} />
              <div className="min-w-0 break-words">
                <span className="font-bold text-black">Bill To:</span>{" "}
                <span className="text-black">{brand.companyName}</span>
              </div>
              {(brand.address || brand.locality) ? (
                <div className="min-w-0 break-words text-black">
                  {brand.address ? <div>{brand.address}</div> : null}
                  {brand.locality ? <div>{brand.locality}</div> : null}
                </div>
              ) : null}
              {brand.contact ? (
                <div
                  className="min-w-0 break-words pt-1.5 text-[15px] font-semibold tracking-wide"
                  style={{ color: brandBlue }}
                >
                  {brand.contact}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Section 2 — Work completed */}
        <h3
          className="mb-1.5 mt-4 text-[16px] font-bold"
          style={{ color: brandBlue }}
        >
          Work completed
        </h3>
        <table className="w-full border-collapse text-[14.5px]">
          <thead>
            <tr className="text-white" style={{ backgroundColor: brandBlue }}>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">
                Property
              </th>
              <th className="w-20 border border-slate-300 px-2.5 py-2 text-center font-semibold">
                Date
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">
                Task
              </th>
              <th className="w-28 border border-slate-300 px-2.5 py-2 text-right font-semibold">
                Amount £
              </th>
            </tr>
          </thead>
          <tbody>
            {w.lines.map((line, i) => (
              <tr
                key={line.id}
                className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
              >
                <td className="border border-slate-200 px-2.5 py-2 text-black">
                  {line.propertyName ?? "—"}
                </td>
                <td className="border border-slate-200 px-2.5 py-2 text-center tabular-nums text-black">
                  {formatWageSheetDayMonth(line.lineDate)}
                </td>
                <td className="border border-slate-200 px-2.5 py-2 text-black">
                  {line.description}
                  {line.isTopUp ? (
                    <span className="ml-1.5 text-[11px] text-slate-400">top-up</span>
                  ) : null}
                </td>
                <td className="border border-slate-200 px-2.5 py-2 text-right tabular-nums text-black">
                  {fmtAmount(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Section 3 — totals, signature, footer */}
        <div className="mt-3 flex justify-end">
          <table className="w-56 border-collapse text-[14.5px]">
            <tbody>
              <tr className="bg-slate-50">
                <td className="border border-slate-200 px-2.5 py-1.5 text-black">Gross Pay £</td>
                <td className="border border-slate-200 px-2.5 py-1.5 text-right tabular-nums text-black">
                  {fmtAmount(w.gross)}
                </td>
              </tr>
              <tr className="bg-white">
                <td className="border border-slate-200 px-2.5 py-1.5 text-black">CIS Rate %</td>
                <td className="border border-slate-200 px-2.5 py-1.5 text-right tabular-nums text-black">
                  {w.cisRate}
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-200 px-2.5 py-1.5 text-black">CIS Tax £</td>
                <td className="border border-slate-200 px-2.5 py-1.5 text-right tabular-nums text-black">
                  −{fmtAmount(w.cisDeduction)}
                </td>
              </tr>
              <tr style={{ backgroundColor: "#e8f5e9" }}>
                <td className="border border-slate-200 px-2.5 py-2 font-bold text-black">
                  Net Pay £
                </td>
                <td className="border border-slate-200 px-2.5 py-2 text-right font-bold tabular-nums text-black">
                  {fmtAmount(w.net)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-[14.5px] text-slate-700">
          {/* Signed / Operative signature fields — temporarily hidden
          <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <SignatureField
              label="Signed"
              dataUrl={w.senderSignatureData}
              editable={canEditSenderSignature}
              onClick={() => onOpenSignature("sender")}
            />
            <SignatureField
              label="Operative"
              dataUrl={w.operativeSignatureData}
              editable={canEditOperativeSignature}
              onClick={() => onOpenSignature("operative")}
              align="right"
            />
          </div>
          */}
          <div className="text-center">
            <p className="italic text-slate-500">Thank you for your business!</p>
            <p className="mt-0.5 text-[12px] italic text-slate-400">
              Template — one sheet per operative, per project, per week. Each sheet
              self-contained.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefusalBanner({
  reason,
  refusedOn,
  refusedByName,
  refusedByRole,
}: {
  reason: string | null;
  refusedOn: string | null;
  refusedByName: string | null;
  refusedByRole: string | null;
}) {
  return (
    <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
          <X className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-foreground">
            Wage sheet refused
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            This wage sheet has been refused and requires some changes before it can be approved.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-destructive">Reason for refusal</p>
            <p className="mt-0.5 text-sm text-foreground">{reason?.trim() || "—"}</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
            <CalendarDays className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-destructive">Refused on</p>
            <p className="mt-0.5 text-sm text-foreground">{formatUkDate(refusedOn)}</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-destructive">Refused by</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {refusedByName?.trim() || "—"}
            </p>
            {refusedByRole?.trim() ? (
              <p className="text-xs text-muted-foreground">{refusedByRole}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignatureField({
  label,
  dataUrl,
  editable,
  onClick,
  align = "left",
}: {
  label: string;
  dataUrl: string | null | undefined;
  editable: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const hasSig = Boolean(dataUrl?.trim());
  // Signature images temporarily hidden (Signed + Operative) — restore img block below when needed
  void hasSig;
  const line = (
    <span
      className={[
        "inline-flex min-h-[3rem] min-w-[14rem] max-w-full items-end border-b border-slate-500 align-bottom",
        align === "right" ? "justify-end" : "justify-start",
        // editable ? "cursor-pointer hover:border-slate-700" : "",
      ].join(" ")}
    >
      {/* Signature image — temporarily hidden
      {hasSig ? (
        <img
          src={dataUrl!}
          alt={`${label} signature`}
          className={[
            "max-h-12 max-w-[14rem] object-contain",
            align === "right" ? "object-right" : "object-left",
          ].join(" ")}
        />
      ) : (
        <span className="pb-1 text-[12px] text-slate-400">
          {editable ? "Click to sign" : "\u00a0"}
        </span>
      )}
      */}
      <span className="pb-1 text-[12px] text-slate-400">{"\u00a0"}</span>
    </span>
  );

  // Keep props so uncommenting the button / images is a one-line restore
  void editable;
  void onClick;
  void dataUrl;

  return (
    <div className={align === "right" ? "sm:text-right" : undefined}>
      <span className="font-medium text-slate-700">{label}:</span>{" "}
      {/* Click to sign button — temporarily disabled
      {editable ? (
        <button type="button" onClick={onClick} className="align-bottom" aria-label={`${label} signature`}>
          {line}
        </button>
      ) : (
        line
      )}
      */}
      {line}
    </div>
  );
}

function HeaderLine({
  label,
  value,
  blank,
}: {
  label: string;
  value: string | null | undefined;
  blank?: boolean;
}) {
  const showBlank = blank && !value;
  return (
    <div>
      <span className="font-bold text-black">{label}:</span>{" "}
      {showBlank ? (
        <span className="inline-block min-w-[10rem] border-b border-slate-400 align-bottom">&nbsp;</span>
      ) : (
        <span className="font-normal text-black">{value || "—"}</span>
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={pending} onClick={onConfirm}>
            <Send className="h-4 w-4" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
