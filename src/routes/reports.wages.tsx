import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "@/components/form";
import { WagesSummaryCards } from "@/components/wages/WagesSummaryCards";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtGBP } from "@/lib/data";
import { reportsService, type ApiWagesReportRow } from "@/lib/api/services/reports";
import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import {
  downloadCsv,
  formatUkDate,
  formatWageWeekRange,
  invoiceNo,
} from "@/lib/week-ending";

export const Route = createFileRoute("/reports/wages")({
  head: () => ({ meta: [{ title: "Wages Report | Schore" }] }),
  component: WagesReport,
});

const linkClass = "font-medium text-info hover:underline";

function WagesReport() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [statusId, setStatusId] = useState("");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [paymentStatusId, setPaymentStatusId] = useState("");
  const [paymentStatusLabel, setPaymentStatusLabel] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, customerId, statusId, paymentStatusId]);

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

  const query = useQuery({
    queryKey: [
      "reports",
      "wages",
      { fromDate, toDate, customerId, statusId, paymentStatusId, page, pageSize },
    ],
    queryFn: async () =>
      (
        await reportsService.getWagesReport({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          customerId: customerId || undefined,
          statusId: statusId || undefined,
          paymentStatusId: paymentStatusId || undefined,
          page,
          pageSize,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const exportCsv = () => {
    if (!data?.rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const stamp = [fromDate || "all", toDate || "all"].join("_");
    downloadCsv(`wages-report-${stamp}.csv`, wagesCsv(data.rows));
    toast.success("Wages report exported");
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Wages Report"
        subtitle="Wage sheets by date — partial weeks recalculate gross, CIS and net from days in range."
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data?.rows.length}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      <WagesSummaryCards
        statementCount={data?.statementCount ?? 0}
        totalGross={data?.totalGross ?? 0}
        totalCisDeduction={data?.totalCisDeduction ?? 0}
        totalNet={data?.totalNet ?? 0}
        statusCounts={data?.statusCounts ?? []}
        statementsTip="Wage sheets matching filters."
        grossTip="Total gross for days in range (partial weeks recalculated)."
        cisTip="CIS on the ranged gross."
        netTip="Total net for the date range."
      />

      <div className="card-elevated overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:gap-2.5 sm:px-4">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="h-8 rounded-md border border-input bg-background px-2.5 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            className="h-8 rounded-md border border-input bg-background px-2.5 text-sm"
          />
          <SearchableSelect
            className="w-full min-w-[9rem] sm:w-40"
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
            aria-label="Filter wages by client"
            queryKey={["users", "customers", "dropdown", "reports-wages"]}
            fetchOptions={fetchCustomerOptions}
            selectedLabel={customerLabel}
            emptyOption={{ value: "", label: "All clients" }}
            triggerClassName="h-8 [&>span]:whitespace-nowrap"
          />
          <SearchableSelect
            className="w-full min-w-[8rem] sm:w-36"
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
            queryKey={["statuses", DOCUMENT_TYPE_CODE.STATEMENT, "reports-wages"]}
            fetchOptions={fetchSignOffOptions}
            selectedLabel={statusLabel}
            emptyOption={{ value: "", label: "All sign-off" }}
            triggerClassName="h-8 [&>span]:whitespace-nowrap"
          />
          <SearchableSelect
            className="w-full min-w-[8rem] sm:w-36"
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
            queryKey={["statuses", DOCUMENT_TYPE_CODE.STATEMENT_PAYMENT, "reports-wages"]}
            fetchOptions={fetchPaymentOptions}
            selectedLabel={paymentStatusLabel}
            emptyOption={{ value: "", label: "All payment" }}
            triggerClassName="h-8 [&>span]:whitespace-nowrap"
          />
        </div>

        <WagesReportTable
          rows={data?.rows ?? []}
          statementCount={data?.statementCount ?? 0}
          totalGross={data?.totalGross ?? 0}
          totalCis={data?.totalCisDeduction ?? 0}
          totalNet={data?.totalNet ?? 0}
          loading={query.isFetching}
        />
        {(data?.totalCount ?? 0) > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={data?.totalCount ?? 0}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            itemLabel="statements"
            disabled={query.isFetching}
            controlsAlign="center"
          />
        ) : null}
      </div>
    </div>
  );
}

function WagesReportTable({
  rows,
  statementCount,
  totalGross,
  totalCis,
  totalNet,
  loading,
}: {
  rows: ApiWagesReportRow[];
  statementCount: number;
  totalGross: number;
  totalCis: number;
  totalNet: number;
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading report…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No wage sheets for these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium sm:px-4">Invoice</th>
            <th className="px-3 py-2 font-medium">Operative</th>
            <th className="px-3 py-2 font-medium">Project</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Week</th>
            <th className="px-3 py-2 text-right font-medium">Gross</th>
            <th className="px-3 py-2 text-right font-medium">
              <AppTooltip content="CIS deduction">CIS</AppTooltip>
            </th>
            <th className="px-3 py-2 text-right font-medium">Net</th>
            <th className="px-3 py-2 font-medium">Payment</th>
            <th className="px-3 py-2 font-medium sm:px-4">Sign-off</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/20">
              <td className="px-3 py-1.5 tabular-nums sm:px-4">
                <AppTooltip content="Open wage sheet" asChild>
                  <Link
                    to="/wages/$id"
                    params={{ id: String(row.id) }}
                    search={{
                      from: "reports-wages" as const,
                      weekEnding: row.weekEnding.slice(0, 10),
                    }}
                    className={`${linkClass} font-mono text-xs`}
                  >
                    {invoiceNo(row.invoiceNumber)}
                  </Link>
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5">
                <AppTooltip content={row.operativeName} asChild align="start">
                  <Link
                    to="/operatives/$id"
                    params={{ id: String(row.operativeId) }}
                    className={`block max-w-[12rem] truncate ${linkClass}`}
                  >
                    {row.operativeName}
                  </Link>
                </AppTooltip>
                {row.tradeName ? (
                  <div className="text-xs text-muted-foreground">{row.tradeName}</div>
                ) : null}
              </td>
              <td className="px-3 py-1.5">
                {row.projectName ? (
                  <AppTooltip content={row.projectName} asChild align="start">
                    <Link
                      to="/projects/$id"
                      params={{ id: String(row.projectId) }}
                      className={`block max-w-[12rem] truncate ${linkClass}`}
                    >
                      {row.projectName}
                    </Link>
                  </AppTooltip>
                ) : (
                  "—"
                )}
                {row.siteName ? (
                  <div className="text-xs text-muted-foreground">{row.siteName}</div>
                ) : null}
              </td>
              <td className="px-3 py-1.5">
                {row.customerNames ? (
                  <AppTooltip content={row.customerNames} asChild align="start">
                    <span className="block max-w-[12rem] truncate">{row.customerNames}</span>
                  </AppTooltip>
                ) : (
                  "—"
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                <AppTooltip
                  content={
                    row.isPartial
                      ? `Partial week — amounts for days in filter only. Sheet week: ${formatWageWeekRange(row.weekStart, row.weekEnding)}`
                      : formatWageWeekRange(row.weekStart, row.weekEnding)
                  }
                >
                  <span>
                    {formatUkDate(row.weekEnding)}
                    {row.isPartial ? (
                      <span className="ml-1 text-[10px] font-medium uppercase text-muted-foreground">
                        partial
                      </span>
                    ) : null}
                  </span>
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtGBP(row.gross)}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                <AppTooltip content={`CIS rate ${row.cisRate}%`}>
                  {fmtGBP(row.cisDeduction)}
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums">
                {fmtGBP(row.net)}
              </td>
              <td className="px-3 py-1.5">
                <AppTooltip content={row.paymentStatusName || row.paymentStatusCode} asChild>
                  <span>{row.paymentStatusName || "—"}</span>
                </AppTooltip>
              </td>
              <td className="px-3 py-1.5 sm:px-4">
                <AppTooltip content={row.statusName || row.statusCode} asChild>
                  <span>{row.statusName || "—"}</span>
                </AppTooltip>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/20 font-medium">
            <td className="px-3 py-2 sm:px-4" colSpan={5}>
              Total ({statementCount})
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(totalGross)}</td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(totalCis)}</td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(totalNet)}</td>
            <td className="px-3 py-2" colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function wagesCsv(rows: ApiWagesReportRow[]): string[][] {
  return [
    [
      "Invoice",
      "Operative",
      "Trade",
      "Project",
      "Site",
      "Client",
      "Week ending",
      "Partial",
      "Gross",
      "CIS",
      "Net",
      "Payment",
      "Sign-off",
    ],
    ...rows.map((r) => [
      invoiceNo(r.invoiceNumber),
      r.operativeName,
      r.tradeName ?? "",
      r.projectName ?? "",
      r.siteName ?? "",
      r.customerNames ?? "",
      formatUkDate(r.weekEnding),
      r.isPartial ? "Yes" : "No",
      String(r.gross),
      String(r.cisDeduction),
      String(r.net),
      r.paymentStatusName,
      r.statusName,
    ]),
  ];
}
