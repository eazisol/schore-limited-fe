import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Send, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import { holidaysService } from "@/lib/api/services/holidays";
import { payStatementsService } from "@/lib/api/services/pay-statements";
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
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/payroll")({
  head: () => ({ meta: [{ title: "Payroll Engine | Schore" }] }),
  component: Payroll,
});

export const payStatementsQueryKey = ["pay-statements"] as const;

function Payroll() {
  const queryClient = useQueryClient();
  const canModify = usePermission({ pathname: "/payroll", action: "modify" });
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
  const [customerId, setCustomerId] = useState<string | "all">("all");

  const customersQuery = useQuery({
    queryKey: ["users", "dropdown", "customers"],
    queryFn: async () =>
      (await usersService.dropdown({ userTypeId: USER_TYPE_ID.customer })).data ?? [],
  });

  const listQuery = useQuery({
    queryKey: [...payStatementsQueryKey, "payroll", { week: selectedWeek, customerId }],
    queryFn: async () =>
      (
        await payStatementsService.list({
          weekEnding: selectedWeek,
          customerId: customerId === "all" ? undefined : customerId,
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
        toast.error("No client lines to export for this week.");
        return;
      }
      for (const bundle of bundles) {
        downloadCsv(`payroll-${bundle.customerName.replaceAll(" ", "-")}-WE-${selectedWeek}.csv`, [
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
    (sum, row) => ({
      gross: sum.gross + row.gross,
      cis: sum.cis + row.cisDeduction,
      net: sum.net + row.net,
    }),
    { gross: 0, cis: 0, net: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Payroll Engine"
        subtitle="Live weekly totals · MAX(price work, daily rate) with CIS. Email is sent only when you press Send."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={exportMutation.isPending || !selectedWeek}
            onClick={() => exportMutation.mutate()}
          >
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export by client
          </Button>
        }
      />

      <div className="card-elevated mb-6 flex flex-wrap gap-3 p-4">
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Week ending</span>
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) => setWeek(e.target.value)}
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Client</span>
          <select
            value={customerId === "all" ? "all" : String(customerId)}
            onChange={(e) => setCustomerId(e.target.value === "all" ? "all" : e.target.value)}
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All (separate on export)</option>
            {(customersQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-elevated p-5">
          <div className="text-xs text-muted-foreground">Gross pay</div>
          <div className="font-display font-semibold font-mono text-2xl">{fmtGBP(totals.gross)}</div>
        </div>
        <div className="card-elevated p-5">
          <div className="text-xs text-muted-foreground">CIS deduction</div>
          <div className="font-display font-semibold font-mono text-2xl text-warning-foreground">{fmtGBP(totals.cis)}</div>
        </div>
        <div className="card-elevated p-5">
          <div className="text-xs text-muted-foreground">Net to pay</div>
          <div className="font-display font-semibold font-mono text-2xl text-success">{fmtGBP(totals.net)}</div>
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Operative</th>
              <th className="px-3 py-3 text-left">Project</th>
              <th className="px-3 py-3 text-left">Client</th>
              <th className="px-3 py-3 text-right">Gross</th>
              <th className="px-3 py-3 text-right">CIS %</th>
              <th className="px-3 py-3 text-right">CIS Tax</th>
              <th className="px-3 py-3 text-right">Net</th>
              <th className="px-3 py-3 text-left">Sign-off</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const canSend = row.statusCode === "DRAFT" || row.statusCode === "REFUSED";
              const canResend = row.statusCode === "SENT";
              return (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{row.operativeName}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.projectName ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.customerNames ?? "—"}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(row.gross)}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{row.cisRate}%</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(row.cisDeduction)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-medium">{fmtGBP(row.net)}</td>
                  <td className="px-3 py-3"><StatusBadge status={row.statusName} /></td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canModify && canSend && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sendMutation.isPending}
                          onClick={() => sendMutation.mutate(row.id)}
                        >
                          <Send className="h-3.5 w-3.5" />Send
                        </Button>
                      )}
                      {canModify && canResend && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resendMutation.isPending}
                          onClick={() => resendMutation.mutate(row.id)}
                        >
                          <Send className="h-3.5 w-3.5" />Resend
                        </Button>
                      )}
                      <Link
                        to="/wages/$id"
                        params={{ id: String(row.id) }}
                        search={{ from: "payroll" }}
                        className="text-xs text-info"
                      >
                        {invoiceNo(row.invoiceNumber)}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {listQuery.isLoading && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">Loading payroll…</td>
              </tr>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No wage sheets for week ending {formatUkDate(selectedWeek)}. Sheets build as work is ticked.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
