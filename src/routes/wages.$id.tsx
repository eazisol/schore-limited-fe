import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Check, X, Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtGBPp } from "@/lib/data";
import { payStatementsService, type ApiPayStatementDetail, type ApiPayStatementDay } from "@/lib/api/services/pay-statements";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/components/Permission";
import { usePermissions } from "@/contexts/PermissionContext";
import { isOperativePortalUser } from "@/lib/operative-portal";
import {
  formatUkDate,
  formatWageSheetDayMonth,
  formatWageWeekRange,
  invoiceNo,
} from "@/lib/week-ending";
import { payStatementsQueryKey } from "./payroll";

const wageDetailSearchSchema = z.object({
  from: z.enum(["payroll"]).optional(),
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

function WageSheetView() {
  const { id } = Route.useParams();
  const { from, weekEnding } = Route.useSearch();
  const wagesListSearch = weekEnding ? { weekEnding } : {};
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

  const w = query.data;
  const isOwner = w != null && user?.id === w.operativeId;
  const canSend = canModify && (w?.statusCode === "DRAFT" || w?.statusCode === "REFUSED");
  const canResend = canModify && w?.statusCode === "SENT";
  const canRespond = isOwner && w?.statusCode === "SENT";
  const canMarkPaid = canModify && w?.statusCode === "ACCEPTED" && w.paymentStatusCode !== "PAID";

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
          <Link
            to={from === "payroll" ? "/payroll" : "/wages"}
            search={from === "payroll" ? undefined : wagesListSearch}
          >
            Back
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-3">
      {from === "payroll" ? (
        <Link to="/payroll" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Payroll Engine
        </Link>
      ) : (
        <Link
          to="/wages"
          search={wagesListSearch}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> All wage sheets
        </Link>
      )}

      <PageHeader
        title={`Wage Sheet · ${invoiceNo(w.id)}`}
        subtitle={`${w.operativeName} · Week ending ${formatUkDate(w.weekEnding)}`}
        actions={
          <>
            <StatusBadge status={w.statusName} />
            <StatusBadge status={w.paymentStatusName} />
            {canSend && (
              <Button
                size="sm"
                className="bg-[#1e3a5f] text-white hover:bg-[#162d4a]"
                onClick={() => setConfirmSend(true)}
              >
                <Send className="h-3.5 w-3.5" />
                Send to operative
              </Button>
            )}
            {canResend && (
              <Button
                size="sm"
                variant="outline"
                className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f]/10"
                onClick={() => setConfirmResend(true)}
              >
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
                  className="bg-[#1e3a5f] text-white hover:bg-[#162d4a]"
                  onClick={() => respondMutation.mutate({ accepted: true })}
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </Button>
              </>
            )}
            {canMarkPaid && (
              <Button
                size="sm"
                className="bg-[#1e3a5f] text-white hover:bg-[#162d4a]"
                onClick={() => setPaidOpen(true)}
              >
                <Banknote className="h-3.5 w-3.5" />
                Mark paid
              </Button>
            )}
          </>
        }
      />

      <WageSheet w={w} />

      {w.days.length > 0 && (
        <div className="card-elevated overflow-hidden">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">Day MAX breakdown</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Price work</th>
                <th className="px-3 py-2 text-left">Daily rate</th>
                <th className="px-3 py-2 text-right">Top-up</th>
                <th className="px-4 py-2 text-right">Day pay</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {w.days.map((day: ApiPayStatementDay) => (
                <tr key={day.id}>
                  <td className="px-4 py-2">{formatUkDate(day.workDate)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtGBPp(day.priceWork)}</td>
                  <td className="px-3 py-2">{day.isDailyTicked ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtGBPp(day.topUp)}</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">{fmtGBPp(day.dayPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {w.refusalReason && (
        <div className="card-elevated border-destructive/30 p-4 text-sm">
          <div className="font-medium text-destructive">Refusal reason</div>
          <p className="mt-1 text-muted-foreground">{w.refusalReason}</p>
        </div>
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
    </div>
  );
}

function WageSheet({ w }: { w: ApiPayStatementDetail }) {
  const weekLabel = formatWageWeekRange(w.weekStart, w.weekEnding);
  const utrNi =
    [w.operativeUtr, w.operativeNiNumber].filter(Boolean).join(" / ") || null;
  const invoice = invoiceNo(w.id);
  const minRows = 8;
  const emptyRows = Math.max(0, minRows - w.lines.length);
  const brandBlue = "#1e3a5f";
  const contactBlue = "#4a7ab0";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm print:border-0 print:shadow-none">
      <div className="px-5 py-5 md:px-6 md:py-6">
        {/* Section 1 — header + info box */}
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2
              className="text-[1.4rem] font-bold uppercase tracking-tight leading-none"
              style={{ color: brandBlue }}
            >
              SCHORE LIMITED
            </h2>
            <span className="text-[0.95rem] font-normal text-slate-500">
              Weekly Wage Sheet
            </span>
          </div>
          <div className="mt-1.5 h-[2.5px] w-full" style={{ backgroundColor: brandBlue }} />
          <p className="mt-1 text-[11px] text-slate-500">
            Construction & Maintenance — Basildon, Essex
          </p>

          <div className="mt-3 grid gap-4 bg-[#f2f2f2] px-4 py-3 text-[12.5px] leading-snug sm:grid-cols-2 sm:gap-8">
            <div className="space-y-0.5">
              <HeaderLine label="Name" value={w.operativeName} />
              <HeaderLine label="Trade" value={w.tradeName ?? w.operativeTradeCode} />
              <HeaderLine label="Site / Contract" value={w.siteContract ?? w.customerNames} />
              <HeaderLine label="Site Manager" value={w.siteManagerName} />
              <HeaderLine label="UTR / NINO" value={utrNi} blank />
            </div>
            <div className="space-y-0.5">
              <HeaderLine label="Invoice No" value={invoice} blank={!invoice} />
              <HeaderLine label="Week" value={weekLabel} />
              <div>
                <span className="font-bold text-black">Bill To:</span>{" "}
                <span className="text-black">Schore Limited</span>
              </div>
              <div className="text-black">
                <div>Unit E, The Business Center, Faringdon</div>
                <div>Avenue,</div>
                <div>Romford, Essex, RM3 8EN</div>
              </div>
              <div className="pt-0.5 text-[11.5px]" style={{ color: contactBlue }}>
                07982138777 · office@schore.co.uk
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Work completed */}
        <h3
          className="mb-1.5 mt-4 text-[14px] font-bold"
          style={{ color: brandBlue }}
        >
          Work completed
        </h3>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-white" style={{ backgroundColor: brandBlue }}>
              <th className="border border-slate-300 px-2.5 py-1.5 text-left font-semibold">
                Property
              </th>
              <th className="w-20 border border-slate-300 px-2.5 py-1.5 text-center font-semibold">
                Date
              </th>
              <th className="border border-slate-300 px-2.5 py-1.5 text-left font-semibold">
                Task
              </th>
              <th className="w-24 border border-slate-300 px-2.5 py-1.5 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {w.lines.map((line, i) => (
              <tr
                key={line.id}
                className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
              >
                <td className="border border-slate-200 px-2.5 py-1.5 text-black">
                  {line.propertyName ?? "—"}
                </td>
                <td className="border border-slate-200 px-2.5 py-1.5 text-center tabular-nums text-black">
                  {formatWageSheetDayMonth(line.lineDate)}
                </td>
                <td className="border border-slate-200 px-2.5 py-1.5 text-black">
                  {line.description}
                  {line.isTopUp ? (
                    <span className="ml-1.5 text-[10px] text-slate-400">top-up</span>
                  ) : null}
                </td>
                <td className="border border-slate-200 px-2.5 py-1.5 text-right tabular-nums text-black">
                  {fmtGBPp(line.amount)}
                </td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr
                key={`empty-${i}`}
                className={(w.lines.length + i) % 2 === 0 ? "bg-white" : "bg-slate-50"}
              >
                <td className="border border-slate-200 px-2.5 py-1.5">&nbsp;</td>
                <td className="border border-slate-200 px-2.5 py-1.5" />
                <td className="border border-slate-200 px-2.5 py-1.5" />
                <td className="border border-slate-200 px-2.5 py-1.5" />
              </tr>
            ))}
          </tbody>
        </table>

        {/* Section 3 — totals, signature, footer */}
        <div className="mt-3 flex justify-end">
          <table className="w-48 border-collapse text-[12.5px]">
            <tbody>
              <tr className="bg-slate-50">
                <td className="border border-slate-200 px-2.5 py-1 text-black">Gross Pay</td>
                <td className="border border-slate-200 px-2.5 py-1 text-right tabular-nums text-black">
                  {fmtGBPp(w.gross)}
                </td>
              </tr>
              <tr className="bg-white">
                <td className="border border-slate-200 px-2.5 py-1 text-black">CIS Rate</td>
                <td className="border border-slate-200 px-2.5 py-1 text-right tabular-nums text-black">
                  {w.cisRate}%
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-200 px-2.5 py-1 text-black">CIS Tax</td>
                <td className="border border-slate-200 px-2.5 py-1 text-right tabular-nums text-black">
                  −{fmtGBPp(w.cisDeduction)}
                </td>
              </tr>
              <tr style={{ backgroundColor: "#e8f5e9" }}>
                <td className="border border-slate-200 px-2.5 py-1.5 font-bold text-black">
                  Net Pay
                </td>
                <td className="border border-slate-200 px-2.5 py-1.5 text-right font-bold tabular-nums text-black">
                  {fmtGBPp(w.net)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-[12.5px] text-slate-700">
          <div className="mb-6">
            Signed:{" "}
            <span className="inline-block min-w-[14rem] border-b border-slate-500 align-bottom">
              &nbsp;
            </span>
          </div>
          <div className="text-center">
            <p className="italic text-slate-500">Thank you for your business!</p>
            <p className="mt-0.5 text-[10.5px] italic text-slate-400">
              Template — one sheet per operative, per contract, per week. Each sheet
              self-contained.
            </p>
          </div>
        </div>
      </div>
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
          <Button
            disabled={pending}
            className="bg-[#1e3a5f] text-white hover:bg-[#162d4a]"
            onClick={onConfirm}
          >
            <Send className="h-4 w-4" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
