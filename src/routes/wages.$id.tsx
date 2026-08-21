import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Check, X, Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtGBPp } from "@/lib/data";
import { payStatementsService, type ApiPayStatementDetail } from "@/lib/api/services/pay-statements";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/components/Permission";
import { formatUkDate, invoiceNo } from "@/lib/week-ending";
import { payStatementsQueryKey } from "./payroll";

export const Route = createFileRoute("/wages/$id")({
  validateSearch: (s: Record<string, unknown>) =>
    ({ from: s.from === "payroll" ? "payroll" : undefined }) as { from?: "payroll" },
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
  const { from } = Route.useSearch();
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
          <Link to={from === "payroll" ? "/payroll" : "/wages"}>Back</Link>
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
        <Link to="/wages" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
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
              {w.days.map((day) => (
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
  const weekLabel = `${formatUkDate(w.weekStart)} – ${formatUkDate(w.weekEnding)}`;
  return (
    <div className="card-elevated max-w-4xl p-8 md:p-10">
      <div className="flex items-start justify-between border-b pb-6">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">SCHORE LIMITED</h2>
          <p className="mt-1 text-xs text-muted-foreground">Weekly Wage Sheet</p>
          <p className="text-[11px] text-muted-foreground">Construction & Maintenance</p>
        </div>
        <div className="space-y-0.5 text-right text-xs">
          <div>
            <span className="text-muted-foreground">Invoice No:</span>{" "}
            <strong className="font-mono">{invoiceNo(w.id)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Week:</span> <strong>{weekLabel}</strong>
          </div>
          <div className="mt-2 text-muted-foreground">Bill To: Schore Limited</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 border-b py-6 text-sm">
        <KV label="Name" value={w.operativeName} />
        <KV label="Trade" value={w.tradeName ?? w.operativeTradeCode ?? "—"} />
        <KV label="Site / Contract" value={w.contractorNames ?? "—"} />
        <KV label="CIS rate" value={`${w.cisRate}%`} />
      </div>

      <h3 className="mb-3 mt-6 font-display font-semibold">Work completed</h3>
      <table className="w-full text-sm">
        <thead className="border-y bg-muted/30 text-xs">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Property</th>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-left font-medium">Task</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {w.lines.map((line) => (
            <tr key={line.id}>
              <td className="px-3 py-2.5">{line.propertyName ?? "—"}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{formatUkDate(line.lineDate)}</td>
              <td className="px-3 py-2.5">
                {line.description}
                {line.isTopUp ? <span className="ml-2 text-[11px] text-muted-foreground">top-up</span> : null}
              </td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtGBPp(line.amount)}</td>
            </tr>
          ))}
          {w.lines.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No lines on this sheet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="ml-auto mt-6 max-w-xs space-y-2 text-sm">
        <Row k="Gross Pay" v={fmtGBPp(w.gross)} />
        <Row k="CIS Rate" v={`${w.cisRate}%`} />
        <Row k="CIS Tax" v={`−${fmtGBPp(w.cisDeduction)}`} muted />
        <div className="border-t pt-2">
          <Row k="Net Pay" v={fmtGBPp(w.net)} bold />
        </div>
      </div>

      <div className="mt-10 border-t pt-6 text-xs text-muted-foreground">
        <div className="mb-8">Signed: ______________________________</div>
        <p className="italic">Thank you for your business.</p>
        {/* <p className="mt-1 text-[10px]">One sheet per operative per week. Line dates use the tick (CompletedDate).</p> */}
      </div>
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

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Row({ k, v, bold, muted }: { k: string; v: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{k}</span>
      <span className={`font-mono tabular-nums ${bold ? "text-lg font-bold" : ""}`}>{v}</span>
    </div>
  );
}
