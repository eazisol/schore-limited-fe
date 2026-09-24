import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import { Download, Loader2, RefreshCw, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import { holidaysService } from "@/lib/api/services/holidays";
import { payStatementsService } from "@/lib/api/services/pay-statements";
import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import { notifyApiError } from "@/lib/api/axios";
import { usePermission } from "@/components/Permission";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import { cn } from "@/lib/utils";
import {
  downloadCsv,
  formatUkDate,
  getWeekEndingDate,
  invoiceNo,
  toYmd,
} from "@/lib/week-ending";
import { payStatementsQueryKey } from "./payroll";

const wagesSearchSchema = z.object({
  weekEnding: z.string().optional(),
});

export const Route = createFileRoute("/wages/")({
  validateSearch: wagesSearchSchema,
  head: () => ({ meta: [{ title: "Wage Sheets | Schore" }] }),
  component: WagesList,
});

type ConfirmAction = {
  type: "send" | "resend";
  id: string;
  operativeName: string;
};

function WagesList() {
  const navigate = useNavigate({ from: "/wages/" });
  const { weekEnding: weekEndingSearch } = Route.useSearch();
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
  const selectedWeek = weekEndingSearch || defaultWeek;

  function setWeek(next: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        weekEnding: next || undefined,
      }),
      replace: true,
    });
  }

  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [statusId, setStatusId] = useState("");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [paymentStatusId, setPaymentStatusId] = useState("");
  const [paymentStatusLabel, setPaymentStatusLabel] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { searchInput, setSearchInput, search } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  useEffect(() => {
    setPage(1);
  }, [selectedWeek, customerId, statusId, paymentStatusId]);

  const fetchSignOffOptions = useCallback(async (term: string): Promise<SearchableSelectOption[]> => {
    const res = await statusesService.list({
      documentTypeCode: DOCUMENT_TYPE_CODE.STATEMENT,
      pageSize: 50,
    });
    const q = term.trim().toLowerCase();
    return (res.data.items ?? [])
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, []);

  const fetchPaymentOptions = useCallback(async (term: string): Promise<SearchableSelectOption[]> => {
    const res = await statusesService.list({
      documentTypeCode: DOCUMENT_TYPE_CODE.STATEMENT_PAYMENT,
      pageSize: 50,
    });
    const q = term.trim().toLowerCase();
    return (res.data.items ?? [])
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, []);

  const listQuery = useQuery({
    queryKey: [
      ...payStatementsQueryKey,
      "wages",
      { selectedWeek, customerId, statusId, paymentStatusId, search, page, pageSize },
    ],
    queryFn: async () =>
      (
        await payStatementsService.list({
          weekEnding: selectedWeek,
          customerId: customerId || undefined,
          statusId: statusId || undefined,
          paymentStatusId: paymentStatusId || undefined,
          search: search || undefined,
          page,
          pageSize,
        })
      ).data,
    enabled: Boolean(selectedWeek),
    placeholderData: keepPreviousData,
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => payStatementsService.send(id),
    onSuccess: (res) => {
      toast.success(res.message || "Statement sent");
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: payStatementsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to send statement"),
  });
  const resendMutation = useMutation({
    mutationFn: (id: string) => payStatementsService.resend(id),
    onSuccess: (res) => {
      toast.success(res.message || "Statement resent");
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: payStatementsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to resend statement"),
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      payStatementsService.export({
        weekEnding: selectedWeek,
        customerId: customerId || undefined,
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
  const totalCount = listQuery.data?.totalCount ?? 0;
  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1);
  const pageSafe = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, w) => ({
          gross: acc.gross + w.gross,
          cis: acc.cis + w.cisDeduction,
          net: acc.net + w.net,
        }),
        { gross: 0, cis: 0, net: 0 },
      ),
    [rows],
  );
  const weekLabel = weekendQuery.data?.weekEndingDayName ?? "configured last working day";
  const confirmPending =
    confirmAction?.type === "send" ? sendMutation.isPending : resendMutation.isPending;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Wage Sheets"
        subtitle={`One sheet per operative per week · Week ending is ${weekLabel.toLowerCase()}`}
      />

      <div className="flex flex-wrap gap-3">
        <Tot label="Gross" value={fmtGBP(totals.gross)} tone="neutral" />
        <Tot label="CIS deducted" value={fmtGBP(totals.cis)} tone="warning" />
        <Tot label="Net pay" value={fmtGBP(totals.net)} tone="accent" />
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-4">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search operative, client, invoice…"
              aria-label="Search wage sheets"
              className="h-9 w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) => setWeek(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Week ending"
          />
          <SearchableSelect
            value={customerId}
            onValueChange={(value) => {
              if (!value) {
                setCustomerId("");
                setCustomerLabel(null);
              }
            }}
            onSelect={(option) => {
              setCustomerId(option.value);
              setCustomerLabel(option.value ? option.label : null);
            }}
            placeholder="All clients"
            searchPlaceholder="Search clients…"
            aria-label="Filter by client"
            queryKey={["users", "customers", "dropdown", "wages-filter"]}
            fetchOptions={fetchCustomerOptions}
            selectedLabel={customerLabel}
            emptyOption={{ value: "", label: "All clients" }}
            className="w-full min-w-[10rem] sm:w-44"
            triggerClassName="h-9 [&>span]:whitespace-nowrap"
          />
          <SearchableSelect
            value={statusId}
            onValueChange={(value) => {
              if (!value) {
                setStatusId("");
                setStatusLabel(null);
              }
            }}
            onSelect={(option) => {
              setStatusId(option.value);
              setStatusLabel(option.value ? option.label : null);
            }}
            placeholder="All sign-off"
            searchPlaceholder="Search sign-off…"
            aria-label="Filter by sign-off status"
            queryKey={["statuses", DOCUMENT_TYPE_CODE.STATEMENT, "wages-filter"]}
            fetchOptions={fetchSignOffOptions}
            selectedLabel={statusLabel}
            emptyOption={{ value: "", label: "All sign-off" }}
            className="w-full min-w-[9rem] sm:w-40"
            triggerClassName="h-9 [&>span]:whitespace-nowrap"
          />
          <SearchableSelect
            value={paymentStatusId}
            onValueChange={(value) => {
              if (!value) {
                setPaymentStatusId("");
                setPaymentStatusLabel(null);
              }
            }}
            onSelect={(option) => {
              setPaymentStatusId(option.value);
              setPaymentStatusLabel(option.value ? option.label : null);
            }}
            placeholder="All payment"
            searchPlaceholder="Search payment…"
            aria-label="Filter by payment status"
            queryKey={["statuses", DOCUMENT_TYPE_CODE.STATEMENT_PAYMENT, "wages-filter"]}
            fetchOptions={fetchPaymentOptions}
            selectedLabel={paymentStatusLabel}
            emptyOption={{ value: "", label: "All payment" }}
            className="w-full min-w-[9rem] sm:w-40"
            triggerClassName="h-9 [&>span]:whitespace-nowrap"
          />
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={exportMutation.isPending || totalCount === 0}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export by client
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Invoice</th>
                <th className="px-3 py-2 text-left font-medium">Operative</th>
                <th className="px-3 py-2 text-left font-medium">Client(s)</th>
                <th className="px-3 py-2 text-left font-medium">Week Ending</th>
                <th className="px-3 py-2 text-right font-medium">Gross</th>
                <th className="px-3 py-2 text-right font-medium">CIS</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-3 py-2 text-left font-medium">Payment</th>
                <th className="px-3 py-2 text-left font-medium">Sign-off</th>
                <th className="px-4 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((w) => {
                const id = String(w.id);
                const canSend = w.statusCode === "DRAFT" || w.statusCode === "REFUSED";
                const canResend = w.statusCode === "SENT";
                return (
                  <tr key={id} className="hover:bg-muted/30">
                    <td className="px-4 py-1.5">
                      <Link
                        to="/wages/$id"
                        params={{ id }}
                        search={{ weekEnding: selectedWeek }}
                        className="font-mono text-xs font-medium hover:text-info"
                      >
                        {invoiceNo(w.id)}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="leading-tight">
                        <span className="font-medium">{w.operativeName}</span>
                        {w.tradeName ? (
                          <span className="text-[11px] text-muted-foreground"> · {w.tradeName}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-1.5 font-mono text-xs">
                      {w.customerNames ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">{formatUkDate(w.weekEnding)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                      {fmtGBP(w.gross)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-destructive">
                      −{fmtGBP(w.cisDeduction)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-sm font-semibold tabular-nums">
                      {fmtGBP(w.net)}
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={w.paymentStatusName} />
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={w.statusName} />
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center justify-end gap-0.5">
                        {canModify && canSend ? (
                          <AppTooltip content="Send statement" asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 px-0 text-muted-foreground hover:bg-accent/15 hover:text-accent"
                              aria-label={`Send statement to ${w.operativeName}`}
                              onClick={() =>
                                setConfirmAction({
                                  type: "send",
                                  id,
                                  operativeName: w.operativeName,
                                })
                              }
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          </AppTooltip>
                        ) : null}
                        {canModify && canResend ? (
                          <AppTooltip content="Resend statement" asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 px-0 text-muted-foreground hover:bg-accent/15 hover:text-accent"
                              aria-label={`Resend statement to ${w.operativeName}`}
                              onClick={() =>
                                setConfirmAction({
                                  type: "resend",
                                  id,
                                  operativeName: w.operativeName,
                                })
                              }
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </AppTooltip>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading wage sheets…
          </div>
        ) : null}
        {!listQuery.isLoading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {search.trim()
              ? "No wage sheets match your search."
              : "No wage sheets for this filter."}
          </div>
        ) : null}
        {!listQuery.isLoading && totalCount > 0 ? (
          <Pagination
            page={pageSafe}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            itemLabel="sheets"
            disabled={listQuery.isFetching}
            controlsAlign="center"
          />
        ) : null}
      </div>

      {confirmAction ? (
        <ConfirmDialog
          title={
            confirmAction.type === "send"
              ? `Send statement to ${confirmAction.operativeName}?`
              : `Resend statement to ${confirmAction.operativeName}?`
          }
          body={
            confirmAction.type === "send"
              ? "The operative will receive an email link. They must sign in to accept or refuse."
              : "The operative will receive the same email link again. Sign-off status will not change."
          }
          confirmLabel={confirmAction.type === "send" ? "Send now" : "Resend now"}
          pending={confirmPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction.type === "send") {
              sendMutation.mutate(confirmAction.id);
            } else {
              resendMutation.mutate(confirmAction.id);
            }
          }}
        />
      ) : null}
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
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Tot({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "accent";
}) {
  return (
    <div
      className={cn(
        "min-w-[9.5rem] rounded-lg border px-4 py-3 shadow-sm",
        tone === "neutral" && "border-border bg-card",
        tone === "warning" && "border-warning/35 bg-warning/5",
        tone === "accent" && "border-accent/40 bg-accent/5",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-display text-xl font-semibold tabular-nums tracking-tight",
          tone === "warning" && "text-warning-foreground",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </div>
    </div>
  );
}
