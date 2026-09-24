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
import { formatUkDate, formatUkDateDots, formatWageWeekRange, invoiceNo } from "@/lib/week-ending";
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
  const isOffice = usePermission({ pathname: "/wages", action: "read" })
    || usePermission({ pathname: "/payroll", action: "read" })
    || usePermission({ pathname: "/statements", action: "read" });
  const canModify = usePermission({ pathname: "/wages", action: "modify" })
    || usePermission({ pathname: "/payroll", action: "modify" })
    || usePermission({ pathname: "/statements", action: "modify" });
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
    <div className="space-y-6">
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
              <Button size="sm" onClick={() => setConfirmSend(true)}>
                <Send className="h-4 w-4" />Send to operative
              </Button>
            )}
            {canResend && (
              <Button size="sm" variant="outline" onClick={() => setConfirmResend(true)}>
                <Send className="h-4 w-4" />Resend to operative
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
                  <X className="h-4 w-4" />Refuse
                </Button>
                <Button size="sm" onClick={() => respondMutation.mutate({ accepted: true })}>
                  <Check className="h-4 w-4" />Accept
                </Button>
              </>
            )}
            {canMarkPaid && (
              <Button size="sm" onClick={() => setPaidOpen(true)}>
                <Banknote className="h-4 w-4" />Mark paid
              </Button>
            )}
          </>
        }
      />

      <WageSheet w={w} />

      {w.days.length > 0 && (
        <div className="card-elevated max-w-4xl overflow-hidden">
          <div className="border-b px-5 py-3 font-semibold">Day MAX breakdown</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Price work</th>
                <th className="px-3 py-2 text-left">Daily rate</th>
                <th className="px-3 py-2 text-right">Top-up</th>
                <th className="px-5 py-2 text-right">Day pay</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {w.days.map((day: ApiPayStatementDay) => (
                <tr key={day.id}>
                  <td className="px-5 py-2">{formatUkDate(day.workDate)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtGBPp(day.priceWork)}</td>
                  <td className="px-3 py-2">{day.isDailyTicked ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtGBPp(day.topUp)}</td>
                  <td className="px-5 py-2 text-right font-mono font-medium">{fmtGBPp(day.dayPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {w.refusalReason && (
        <div className="card-elevated max-w-4xl border-destructive/30 p-4 text-sm">
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
  const minRows = 8;
  const emptyRows = Math.max(0, minRows - w.lines.length);

  return (
    <div className="max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm print:border-0 print:shadow-none">
      <div className="px-8 pb-8 pt-8 md:px-10 md:pt-10">
        <div className="border-b-[3px] pb-3" style={{ borderColor: "#1e3a5f" }}>
          <h2 className="text-[1.65rem] font-bold tracking-tight" style={{ color: "#1e3a5f" }}>
            SCHORE LIMITED{" "}
            <span className="font-semibold" style={{ color: "#1e3a5f" }}>Weekly Wage Sheet</span>
          </h2>
        </div>

        <div className="mt-5 grid gap-8 sm:grid-cols-2">
          <div className="space-y-1.5 text-[13px] leading-relaxed">
            <HeaderLine label="Name" value={w.operativeName} />
            <HeaderLine label="Trade" value={w.tradeName ?? w.operativeTradeCode} />
            <HeaderLine label="Site / Contract" value={w.siteContract ?? w.customerNames} />
            <HeaderLine label="Site Manager" value={w.siteManagerName} />
            <HeaderLine label="UTR / NINO" value={utrNi} blank />
          </div>
          <div className="space-y-1.5 text-[13px] leading-relaxed sm:text-right">
            <div>
              <span className="text-slate-500">Invoice No:</span>{" "}
              <span className="font-semibold tabular-nums">{invoiceNo(w.id)}</span>
            </div>
            <div>
              <span className="text-slate-500">Week:</span>{" "}
              <span className="font-semibold tabular-nums">{weekLabel}</span>
            </div>
            <div className="pt-1 text-slate-600 sm:ml-auto sm:max-w-[16rem]">
              <div className="font-medium text-slate-800">Bill To: Schore Limited</div>
              <div>Unit E, The Business Center</div>
              <div>Faringdon Avenue</div>
              <div>Romford, Essex, RM3 8EN</div>
              <div className="mt-1 text-[12px]">07982138777 · office@schore.co.uk</div>
            </div>
          </div>
        </div>

        <h3 className="mb-2 mt-7 text-[15px] font-semibold text-slate-900">Work completed</h3>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-white" style={{ backgroundColor: "#1e3a5f" }}>
              <th className="px-3 py-2 text-left font-semibold">Property</th>
              <th className="w-28 px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Task</th>
              <th className="w-28 px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {w.lines.map((line, i) => (
              <tr
                key={line.id}
                className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
              >
                <td className="border-b border-slate-200 px-3 py-2.5">
                  {line.propertyName ?? "—"}
                </td>
                <td className="border-b border-slate-200 px-3 py-2.5 tabular-nums text-slate-700">
                  {formatUkDateDots(line.lineDate)}
                </td>
                <td className="border-b border-slate-200 px-3 py-2.5">
                  {line.description}
                  {line.isTopUp ? (
                    <span className="ml-1.5 text-[11px] text-slate-400">top-up</span>
                  ) : null}
                </td>
                <td className="border-b border-slate-200 px-3 py-2.5 text-right font-medium tabular-nums">
                  {fmtGBPp(line.amount)}
                </td>
              </tr>
            ))}
            {w.lines.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="border-b border-slate-200 px-3 py-8 text-center text-slate-400"
                >
                  No lines on this sheet.
                </td>
              </tr>
            )}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`empty-${i}`} className={(w.lines.length + i) % 2 === 0 ? "bg-white" : "bg-slate-50/80"}>
                <td className="border-b border-slate-200 px-3 py-2.5">&nbsp;</td>
                <td className="border-b border-slate-200 px-3 py-2.5" />
                <td className="border-b border-slate-200 px-3 py-2.5" />
                <td className="border-b border-slate-200 px-3 py-2.5" />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <table className="w-56 border-collapse text-[13px]">
            <tbody>
              <tr>
                <td className="border border-slate-200 px-3 py-1.5 text-slate-600">Gross Pay</td>
                <td className="border border-slate-200 px-3 py-1.5 text-right font-medium tabular-nums">
                  {fmtGBPp(w.gross)}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-1.5 text-slate-600">CIS Rate</td>
                <td className="border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                  {w.cisRate}%
                </td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-1.5 text-slate-600">CIS Tax</td>
                <td className="border border-slate-200 px-3 py-1.5 text-right tabular-nums text-slate-600">
                  −{fmtGBPp(w.cisDeduction)}
                </td>
              </tr>
              <tr className="bg-emerald-50">
                <td className="border border-slate-200 px-3 py-2 font-semibold">Net Pay</td>
                <td className="border border-slate-200 px-3 py-2 text-right text-base font-bold tabular-nums text-emerald-800">
                  {fmtGBPp(w.net)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-[13px] text-slate-600">
          <div className="mb-8">
            Signed: <span className="inline-block min-w-[14rem] border-b border-slate-400">&nbsp;</span>
          </div>
          <p className="italic text-slate-500">Thank you for your business!</p>
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
      <span className="text-slate-500">{label}:</span>{" "}
      {showBlank ? (
        <span className="inline-block min-w-[10rem] border-b border-slate-300 align-bottom">&nbsp;</span>
      ) : (
        <span className="font-medium text-slate-900">{value || "—"}</span>
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
