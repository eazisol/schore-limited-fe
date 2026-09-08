import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/rate-approvals")({
  head: () => ({ meta: [{ title: "Rate Approvals | Schore" }] }),
  component: RateApprovals,
});

const ALL_STATUS = "all";
const RATE_CHANGE_STATUS_PENDING = "PENDING";

function RateApprovals() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: RATE_APPROVALS_ROUTE, action: "modify" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [rejectRow, setRejectRow] = useState<ApiRateChangeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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
    mutationFn: (id: string) => rateChangeRequestsService.approve(id),
    onSuccess: (res) => {
      toast.success(res.message || "Rate change approved");
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
  const busyId = approveMutation.isPending ? approveMutation.variables : undefined;

  const columns: DataTableColumn<ApiRateChangeRequest>[] = [
    {
      id: "item",
      header: "Item",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.productName || "Item"}</div>
          <div className="text-xs text-muted-foreground">
            {rateScopeLabel(row.scope)} · {row.parentLabel || "—"}
          </div>
        </div>
      ),
    },
    {
      id: "change",
      header: "Change",
      cell: (row) => (
        <div className="tabular-nums">
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
      cellClassName: "max-w-[16rem] text-muted-foreground",
      cell: (row) => <span className="line-clamp-2">{row.reason || "—"}</span>,
    },
    {
      id: "requested",
      header: "Requested",
      cell: (row) => (
        <div>
          <div>{row.requestedByName || "—"}</div>
          <div className="text-xs text-muted-foreground">{formatDateTime(row.requestedDate)}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.statusName || row.statusCode} />,
    },
    {
      id: "reviewed",
      header: "Reviewed",
      cell: (row) =>
        row.reviewedByName ? (
          <div>
            <div>{row.reviewedByName}</div>
            <div className="text-xs text-muted-foreground">{formatDateTime(row.reviewedDate)}</div>
            {row.reviewReason ? (
              <div className="text-xs text-muted-foreground">{row.reviewReason}</div>
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
      icon: <Check className="h-4 w-4" />,
      hidden: (row) => !canModify || !row.canApprove,
      onClick: (row) => approveMutation.mutate(row.id),
    },
    {
      id: "reject",
      label: "Reject",
      icon: <X className="h-4 w-4" />,
      danger: true,
      hidden: (row) => !canModify || !row.canApprove,
      onClick: (row) => {
        setRejectReason("");
        setRejectRow(row);
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rate approvals"
        subtitle="Pending rates above the parent budget wait here. Approve or reject — live rates only change after approval."
      />

      <div className="mb-3 flex flex-wrap gap-1">
        {statuses.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            size="sm"
            variant={selectedStatusId === filter.id ? "default" : "outline"}
            className={cn(
              "h-7 px-2.5 text-xs",
              selectedStatusId === filter.id ? "" : "text-muted-foreground",
            )}
            onClick={() => {
              setStatusId(filter.id);
              setPage(1);
            }}
          >
            {filter.name}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={statusId === ALL_STATUS ? "default" : "outline"}
          className={cn(
            "h-7 px-2.5 text-xs",
            statusId === ALL_STATUS ? "" : "text-muted-foreground",
          )}
          onClick={() => {
            setStatusId(ALL_STATUS);
            setPage(1);
          }}
        >
          All
        </Button>
      </div>

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
        rowActions={rowActions}
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
