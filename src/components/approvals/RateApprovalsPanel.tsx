import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import {
  RATE_APPROVALS_ROUTE,
  rateChangeRequestsQueryKey,
  rateChangeRequestsService,
  rateScopeLabel,
  type ApiRateChangeRequest,
} from "@/lib/api/services/rate-change-requests";
import { DOCUMENT_TYPE_CODE, statusesService } from "@/lib/api/services/statuses";
import { fmtGBPp } from "@/lib/data";
import { formatDateTime } from "@/lib/module-ui";
import { usePermission } from "@/components/Permission";
import { toast } from "sonner";

const ALL_STATUS = "all";
const RATE_CHANGE_STATUS_PENDING = "PENDING";

export function RateApprovalsPanel() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: RATE_APPROVALS_ROUTE, action: "modify" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [rejectRow, setRejectRow] = useState<ApiRateChangeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveRow, setApproveRow] = useState<ApiRateChangeRequest | null>(null);
  const [approveRate, setApproveRate] = useState("");
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const statusesQuery = useQuery({
    queryKey: ["statuses", DOCUMENT_TYPE_CODE.RATE_CHANGE],
    queryFn: async () =>
      (
        await statusesService.list({
          documentTypeCode: DOCUMENT_TYPE_CODE.RATE_CHANGE,
          pageSize: 50,
        })
      ).data.items.filter((s) => s.isActive),
  });

  const statuses = [...(statusesQuery.data ?? [])].sort((a, b) => a.orderBy - b.orderBy);
  const pendingStatus = statuses.find((s) => s.code === RATE_CHANGE_STATUS_PENDING);
  const selectedStatusId =
    statusId === ALL_STATUS ? undefined : (statusId ?? pendingStatus?.id);
  const selectedStatus = statuses.find((s) => s.id === selectedStatusId);

  const query = useQuery({
    queryKey: [...rateChangeRequestsQueryKey, { page, pageSize, search, statusId: selectedStatusId }],
    queryFn: async () =>
      (
        await rateChangeRequestsService.list({
          page,
          pageSize,
          search,
          statusId: selectedStatusId,
        })
      ).data,
    enabled: statusesQuery.isSuccess,
    placeholderData: keepPreviousData,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approvedRate }: { id: string; approvedRate?: number }) =>
      rateChangeRequestsService.approve(id, approvedRate),
    onSuccess: (res) => {
      toast.success(res.message || "Rate change approved");
      setApproveRow(null);
      setApproveRate("");
      qc.invalidateQueries({ queryKey: rateChangeRequestsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Unable to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rateChangeRequestsService.reject(id, reason),
    onSuccess: (res) => {
      toast.success(res.message || "Rate change rejected");
      setRejectRow(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: rateChangeRequestsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Unable to reject"),
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;
  const busyId = approveMutation.isPending ? approveMutation.variables?.id : undefined;
  const parsedApproveRate = Number(approveRate);
  const approveRateValid =
    approveRate.trim() !== "" && Number.isFinite(parsedApproveRate) && parsedApproveRate >= 0;

  function openApprove(row: ApiRateChangeRequest) {
    if (row.action.toUpperCase() === "REMOVE") {
      approveMutation.mutate({ id: row.id });
      return;
    }
    setApproveRate(String(row.proposedRate ?? ""));
    setApproveRow(row);
  }

  const columns: DataTableColumn<ApiRateChangeRequest>[] = [
    {
      id: "item",
      header: "Item",
      width: "14rem",
      truncate: false,
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.productName || "Item"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {rateScopeLabel(row.scope)} · {row.parentLabel || "—"}
          </div>
        </div>
      ),
    },
    {
      id: "property",
      header: "Property",
      width: "11rem",
      accessor: (row) => row.propertyName || undefined,
      cell: (row) => row.propertyName || "—",
    },
    {
      id: "client",
      header: "Client",
      width: "11rem",
      accessor: (row) => row.clientName || undefined,
      cell: (row) => row.clientName || "—",
    },
    {
      id: "change",
      header: "Change",
      width: "11rem",
      truncate: false,
      cell: (row) => (
        <div className="whitespace-nowrap tabular-nums">
          <span className="text-muted-foreground">
            {row.action.toUpperCase() === "REMOVE"
              ? "Remove"
              : row.previousRate != null
                ? fmtGBPp(row.previousRate)
                : "New"}
          </span>
          {row.action.toUpperCase() === "REMOVE" ? null : (
            <>
              <span className="mx-1 text-muted-foreground">→</span>
              <span className="font-medium">{fmtGBPp(row.proposedRate)}</span>
            </>
          )}
          {row.exceedsCap ? (
            <div className="text-[11px] font-medium text-destructive">Above cap</div>
          ) : null}
        </div>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      width: "14rem",
      accessor: (row) => row.reason?.trim() || undefined,
      cell: (row) => row.reason?.trim() || "—",
    },
    {
      id: "requested",
      header: "Requested",
      width: "10rem",
      truncate: false,
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate">{row.requestedByName || "—"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {formatDateTime(row.requestedDate)}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "8rem",
      truncate: false,
      cell: (row) => <StatusBadge status={row.statusName || row.statusCode} />,
    },
    {
      id: "reviewed",
      header: "Reviewed",
      width: "11rem",
      truncate: false,
      cell: (row) =>
        row.reviewedByName ? (
          <div className="min-w-0">
            <div className="truncate">{row.reviewedByName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {formatDateTime(row.reviewedDate)}
            </div>
            {row.reviewReason ? (
              <div className="truncate text-xs text-muted-foreground">{row.reviewReason}</div>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const rowActions: DataTableRowAction<ApiRateChangeRequest>[] = [
    {
      id: "approve",
      label: "Approve",
      icon: <Check className="h-3.5 w-3.5" />,
      hidden: (row) => !canModify || !row.canApprove,
      onClick: (row) => openApprove(row),
    },
    {
      id: "reject",
      label: "Reject",
      icon: <X className="h-3.5 w-3.5" />,
      danger: true,
      hidden: (row) => !canModify || !row.canApprove,
      onClick: (row) => {
        setRejectReason("");
        setRejectRow(row);
      },
    },
  ];

  const hasActionableRows = rows.some((row) => canModify && row.canApprove);

  return (
    <div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={query.isLoading || statusesQuery.isLoading}
        fetching={query.isFetching}
        loadingText="Loading rate changes…"
        error={
          query.isError || statusesQuery.isError
            ? {
                title: "Unable to load rate changes",
                message:
                  (query.error as unknown as ApiError)?.message
                  || (statusesQuery.error as unknown as ApiError)?.message
                  || "Please try again.",
                onRetry: () => {
                  void statusesQuery.refetch();
                  void query.refetch();
                },
              }
            : null
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Search item, client, reason…",
          "aria-label": "Search rate changes",
        }}
        filters={
          <Select
            value={statusId ?? pendingStatus?.id ?? ALL_STATUS}
            onValueChange={(next) => {
              setStatusId(next === ALL_STATUS ? ALL_STATUS : next);
              setPage(1);
            }}
          >
            <SelectTrigger
              className="h-9 w-full min-w-[10rem] sm:w-48 [&>span]:whitespace-nowrap"
              aria-label="Filter by status"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {statuses.map((filter) => (
                <SelectItem key={filter.id} value={filter.id}>
                  {filter.name}
                </SelectItem>
              ))}
              <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
            </SelectContent>
          </Select>
        }
        emptyState={{
          title:
            selectedStatus?.code === RATE_CHANGE_STATUS_PENDING
              ? "No pending rate changes"
              : "No rate changes",
          description: search
            ? "Try clearing the search."
            : "When someone changes a client, site, project, or operative rate, it appears here.",
          action: search ? (
            <Button variant="outline" size="sm" onClick={clearSearch}>
              Clear search
            </Button>
          ) : null,
        }}
        rowActions={hasActionableRows ? rowActions : undefined}
        stickyActions={hasActionableRows}
        actionsColumnWidth="8rem"
        pagination={{
          page,
          pageSize,
          totalCount,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          itemLabel: "requests",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {busyId ? (
        <p className="sr-only">
          <Loader2 className="h-4 w-4 animate-spin" /> Approving…
        </p>
      ) : null}

      {approveRow ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => !approveMutation.isPending && setApproveRow(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Approve this rate change?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {approveRow.productName} on {approveRow.parentLabel}. You can keep the proposed rate
              or enter a different amount to approve.
            </p>
            <p className="mt-3 text-sm tabular-nums text-muted-foreground">
              Proposed{" "}
              <span className="font-medium text-foreground">
                {fmtGBPp(approveRow.proposedRate)}
              </span>
              {approveRow.previousRate != null ? (
                <>
                  {" "}
                  · was {fmtGBPp(approveRow.previousRate)}
                </>
              ) : null}
            </p>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Approved rate (£) <span className="text-destructive">*</span>
            </label>
            <Input
              className="mt-1"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={approveRate}
              onChange={(e) => setApproveRate(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setApproveRow(null)}
                disabled={approveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                disabled={approveMutation.isPending || !approveRateValid}
                onClick={() =>
                  approveMutation.mutate({
                    id: approveRow.id,
                    approvedRate: parsedApproveRate,
                  })
                }
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectRow ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => !rejectMutation.isPending && setRejectRow(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Reject this rate change?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {rejectRow.productName} on {rejectRow.parentLabel}. Live rate stays as it is.
            </p>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              className="mt-1"
              rows={3}
              maxLength={500}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this change rejected?"
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRejectRow(null)}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                onClick={() =>
                  rejectMutation.mutate({ id: rejectRow.id, reason: rejectReason.trim() })
                }
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Reject"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
