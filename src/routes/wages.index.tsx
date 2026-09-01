import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import { holidaysService } from "@/lib/api/services/holidays";
import { payStatementsService } from "@/lib/api/services/pay-statements";
import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import { usersService } from "@/lib/api/services/users";
import { USER_TYPE_ID } from "@/lib/user-module";
import { notifyApiError } from "@/lib/api/axios";
import { usePermission } from "@/components/Permission";
import {
  downloadCsv,
  formatUkDate,
  getWeekEndingDate,
  invoiceNo,
  toYmd,
} from "@/lib/week-ending";
import { payStatementsQueryKey } from "./payroll";

export const Route = createFileRoute("/wages/")({
  head: () => ({ meta: [{ title: "Wage Sheets | Schore" }] }),
  component: WagesList,
});

function WagesList() {
  const queryClient = useQueryClient();
  const canModify = usePermission({ pathname: "/wages", action: "modify" });
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
  const [customerId, setCustomerId] = useState<number | "all">("all");
  const [statusId, setStatusId] = useState<number | "all">("all");
  const [paymentStatusId, setPaymentStatusId] = useState<number | "all">("all");

  const customersQuery = useQuery({
    queryKey: ["users", "dropdown", "customers"],
    queryFn: async () =>
      (await usersService.dropdown({ userTypeId: USER_TYPE_ID.customer })).data ?? [],
  });
  const signOffStatuses = useQuery({
    queryKey: ["statuses", DOCUMENT_TYPE_CODE.STATEMENT],
    queryFn: async () =>
      (await statusesService.list({ documentTypeCode: DOCUMENT_TYPE_CODE.STATEMENT, pageSize: 50 })).data
        .items,
  });
  const paymentStatuses = useQuery({
    queryKey: ["statuses", DOCUMENT_TYPE_CODE.STATEMENT_PAYMENT],
    queryFn: async () =>
      (await statusesService.list({
        documentTypeCode: DOCUMENT_TYPE_CODE.STATEMENT_PAYMENT,
        pageSize: 50,
      })).data.items,
  });

  const listQuery = useQuery({
    queryKey: [
      ...payStatementsQueryKey,
      "wages",
      { selectedWeek, customerId, statusId, paymentStatusId },
    ],
    queryFn: async () =>
      (
        await payStatementsService.list({
          weekEnding: selectedWeek,
          customerId: customerId === "all" ? undefined : customerId,
          statusId: statusId === "all" ? undefined : statusId,
          paymentStatusId: paymentStatusId === "all" ? undefined : paymentStatusId,
          page: 1,
          pageSize: 200,
        })
      ).data,
    enabled: Boolean(selectedWeek),
    placeholderData: keepPreviousData,
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => payStatementsService.send(id),
    onSuccess: (res) => {
      toast.success(res.message || "Statement sent");
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

  const exportMutation = useMutation({
    mutationFn: () =>
      payStatementsService.export({
        weekEnding: selectedWeek,
        customerId: customerId === "all" ? undefined : customerId,
      }),
    onSuccess: (res) => {
      const bundles = res.data?.customers ?? [];
      if (bundles.length === 0) {
        toast.error("No client lines to export.");
        return;
      }
      for (const bundle of bundles) {
        downloadCsv(`wages-${bundle.customerName.replaceAll(" ", "-")}-WE-${selectedWeek}.csv`, [
          ["Client", "Operative", "Date", "Property", "Description", "Amount", "Top-up"],
          ...bundle.lines.map((line) => [
            bundle.customerName,
            line.operativeName,
            line.lineDate,
            line.propertyName ?? "",
            line.description,
            String(line.amount),
            line.isTopUp ? "Yes" : "No",
          ]),
        ]);
      }
      toast.success(`Exported ${bundles.length} client file(s)`);
    },
    onError: (err) => notifyApiError(err, "Export failed"),
  });

  const rows = listQuery.data?.items ?? [];
  const totals = rows.reduce(
    (acc, w) => ({ gross: acc.gross + w.gross, cis: acc.cis + w.cisDeduction, net: acc.net + w.net }),
    { gross: 0, cis: 0, net: 0 },
  );
  const weekLabel = weekendQuery.data?.weekEndingDayName ?? "configured last working day";

  return (
    <div>
      <PageHeader
        title="Wage Sheets"
        subtitle={`One sheet per operative per week · Week ending is ${weekLabel.toLowerCase()}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            <Download className="h-4 w-4" />Export by client
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tot label="Gross" value={fmtGBP(totals.gross)} />
        <Tot label="CIS deducted" value={fmtGBP(totals.cis)} />
        <Tot label="Net pay" value={fmtGBP(totals.net)} accent />
      </div>

      <div className="card-elevated">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) => setWeek(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            value={customerId === "all" ? "all" : String(customerId)}
            onChange={(e) => setCustomerId(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All clients</option>
            {(customersQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusId === "all" ? "all" : String(statusId)}
            onChange={(e) => setStatusId(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All sign-off</option>
            {(signOffStatuses.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={paymentStatusId === "all" ? "all" : String(paymentStatusId)}
            onChange={(e) =>
              setPaymentStatusId(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All payment</option>
            {(paymentStatuses.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="ml-auto self-center text-xs text-muted-foreground">{rows.length} sheets</div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Invoice</th>
              <th className="px-3 py-2.5 text-left font-medium">Operative</th>
              <th className="px-3 py-2.5 text-left font-medium">Client(s)</th>
              <th className="px-3 py-2.5 text-left font-medium">Week Ending</th>
              <th className="px-3 py-2.5 text-right font-medium">Gross</th>
              <th className="px-3 py-2.5 text-right font-medium">CIS</th>
              <th className="px-3 py-2.5 text-right font-medium">Net</th>
              <th className="px-3 py-2.5 text-left font-medium">Sign-off</th>
              <th className="px-5 py-2.5 text-left font-medium">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((w) => {
              const canSend = w.statusCode === "DRAFT" || w.statusCode === "REFUSED";
              const canResend = w.statusCode === "SENT";
              return (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link
                      to="/wages/$id"
                      params={{ id: String(w.id) }}
                      className="font-mono text-xs font-medium hover:text-info hover:underline"
                    >
                      {invoiceNo(w.id)}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{w.operativeName}</div>
                    <div className="text-[11px] text-muted-foreground">{w.tradeName ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <code className="font-mono text-xs">{w.customerNames ?? "—"}</code>
                  </td>
                  <td className="px-3 py-3">{formatUkDate(w.weekEnding)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(w.gross)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-destructive">
                    −{fmtGBP(w.cisDeduction)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">{fmtGBP(w.net)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={w.statusName} />
                      {canModify && canSend && (
                        <Button size="sm" variant="ghost" onClick={() => sendMutation.mutate(w.id)}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canModify && canResend && (
                        <Button size="sm" variant="ghost" onClick={() => resendMutation.mutate(w.id)}>
                          <Send className="h-3.5 w-3.5" />Resend
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={w.paymentStatusName} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!listQuery.isLoading && rows.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No wage sheets for this filter.</div>
        )}
      </div>
    </div>
  );
}

function Tot({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card-elevated p-4 ${accent ? "border-accent/40 bg-accent/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
