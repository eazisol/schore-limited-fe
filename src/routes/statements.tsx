import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, Banknote } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";
import { holidaysService } from "@/lib/api/services/holidays";
import { payStatementsService } from "@/lib/api/services/pay-statements";
import { notifyApiError } from "@/lib/api/axios";
import { usePermission } from "@/components/Permission";
import { formatUkDate, getWeekEndingDate, invoiceNo, toYmd } from "@/lib/week-ending";
import { payStatementsQueryKey } from "./payroll";

export const Route = createFileRoute("/statements")({
  head: () => ({ meta: [{ title: "Statements | Schore" }] }),
  component: Statements,
});

function Statements() {
  const queryClient = useQueryClient();
  const canModify = usePermission({ pathname: "/statements", action: "modify" });
  const weekendQuery = useQuery({
    queryKey: ["holidays", "weekend"],
    queryFn: async () => (await holidaysService.getWeekend()).data,
  });
  const defaultWeek = useMemo(() => {
    const weekend = weekendQuery.data;
    if (!weekend) return toYmd(new Date());
    return toYmd(getWeekEndingDate(new Date(), weekend.days, weekend.weekEndingDay));
  }, [weekendQuery.data]);
  const [weekEnding, setWeek] = useState("");
  const selectedWeek = weekEnding || defaultWeek;

  const listQuery = useQuery({
    queryKey: [...payStatementsQueryKey, "statements", selectedWeek],
    queryFn: async () =>
      (await payStatementsService.list({ weekEnding: selectedWeek, page: 1, pageSize: 200 })).data,
    enabled: Boolean(selectedWeek),
    placeholderData: keepPreviousData,
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => payStatementsService.send(id),
    onSuccess: (res) => {
      toast.success(res.message || "Statement emailed to operative");
      queryClient.invalidateQueries({ queryKey: payStatementsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to send statement"),
  });
  const resendMutation = useMutation({
    mutationFn: (id: number) => payStatementsService.resend(id),
    onSuccess: (res) => {
      toast.success(res.message || "Statement resent");
      queryClient.invalidateQueries({ queryKey: payStatementsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to resend statement"),
  });
  const paidMutation = useMutation({
    mutationFn: (id: number) => payStatementsService.markPaid(id, {}),
    onSuccess: (res) => {
      toast.success(res.message || "Marked paid");
      queryClient.invalidateQueries({ queryKey: payStatementsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to mark paid"),
  });

  const rows = listQuery.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Statements"
        subtitle="Office send, sign-off status, refusal reason, and paid / unpaid. Operatives accept or refuse after login."
      />
      <div className="card-elevated mb-4 p-4">
        <label className="text-[11px] font-medium text-muted-foreground">Week ending</label>
        <input
          type="date"
          value={selectedWeek}
          onChange={(e) => setWeek(e.target.value)}
          className="ml-3 h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Statement</th>
              <th className="px-3 py-3 text-left">Operative</th>
              <th className="px-3 py-3 text-left">Week</th>
              <th className="px-3 py-3 text-right">Net</th>
              <th className="px-3 py-3 text-left">Sign-off</th>
              <th className="px-3 py-3 text-left">Payment</th>
              <th className="px-3 py-3 text-left">Response date</th>
              <th className="px-3 py-3 text-left">Refusal reason</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((w) => {
              const canSend = w.statusCode === "DRAFT" || w.statusCode === "REFUSED";
              const canResend = w.statusCode === "SENT";
              const canPay = w.statusCode === "ACCEPTED" && w.paymentStatusCode !== "PAID";
              const responseDate = w.approveDate ?? w.rejectDate;
              return (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link to="/wages/$id" params={{ id: String(w.id) }} className="font-mono text-xs">
                      {invoiceNo(w.invoiceNumber)}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-medium">{w.operativeName}</td>
                  <td className="px-3 py-3 text-muted-foreground">WE {formatUkDate(w.weekEnding)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(w.net)}</td>
                  <td className="px-3 py-3"><StatusBadge status={w.statusName} /></td>
                  <td className="px-3 py-3"><StatusBadge status={w.paymentStatusName} /></td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {responseDate ? formatUkDate(responseDate) : "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{w.refusalReason ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canModify && canSend && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sendMutation.isPending}
                          onClick={() => sendMutation.mutate(w.id)}
                        >
                          {sendMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                          Send
                        </Button>
                      )}
                      {canModify && canResend && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resendMutation.isPending}
                          onClick={() => resendMutation.mutate(w.id)}
                        >
                          {resendMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                          Resend
                        </Button>
                      )}
                      {canModify && canPay && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={paidMutation.isPending}
                          onClick={() => paidMutation.mutate(w.id)}
                        >
                          <Banknote className="h-3.5 w-3.5" />Paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!listQuery.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No statements for this week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
