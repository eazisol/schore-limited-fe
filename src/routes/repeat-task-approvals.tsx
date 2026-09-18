import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
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
  REPEAT_TASK_APPROVALS_ROUTE,
  repeatTaskApprovalsQueryKey,
  repeatTaskApprovalsService,
  type ApiRepeatTaskApproval,
} from "@/lib/api/services/repeat-task-approvals";
import { DOCUMENT_TYPE_CODE, statusesService } from "@/lib/api/services/statuses";
import { formatDateTime } from "@/lib/module-ui";
import { usePermission } from "@/components/Permission";
import { toast } from "sonner";

export const Route = createFileRoute("/repeat-task-approvals")({
  head: () => ({ meta: [{ title: "Repeat Task Approvals | Schore" }] }),
  component: RepeatTaskApprovals,
});

const ALL_STATUS = "all";
const REPEAT_TASK_STATUS_PENDING = "PENDING";

function RepeatTaskApprovals() {
  const qc = useQueryClient();
  const canModify = usePermission({ route: REPEAT_TASK_APPROVALS_ROUTE, action: "modify" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [rejectRow, setRejectRow] = useState<ApiRepeatTaskApproval | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const statusesQuery = useQuery({
    queryKey: ["statuses", DOCUMENT_TYPE_CODE.REPEAT_TASK],
    queryFn: async () =>
      (
        await statusesService.list({
          documentTypeCode: DOCUMENT_TYPE_CODE.REPEAT_TASK,
          pageSize: 50,
        })
      ).data.items.filter((s) => s.isActive),
  });

  const statuses = [...(statusesQuery.data ?? [])].sort((a, b) => a.orderBy - b.orderBy);
  const pendingStatus = statuses.find((s) => s.code === REPEAT_TASK_STATUS_PENDING);
  const selectedStatusId =
    statusId === ALL_STATUS ? undefined : (statusId ?? pendingStatus?.id);
  const selectedStatus = statuses.find((s) => s.id === selectedStatusId);

  const query = useQuery({
    queryKey: [
      ...repeatTaskApprovalsQueryKey,
      { page, pageSize, search, statusId: selectedStatusId },
    ],
    queryFn: async () =>
      (
        await repeatTaskApprovalsService.list({
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
    mutationFn: (id: string) => repeatTaskApprovalsService.approve(id),
    onSuccess: (res) => {
      toast.success(res.message || "Repeat task approved");
      qc.invalidateQueries({ queryKey: repeatTaskApprovalsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Unable to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repeatTaskApprovalsService.reject(id, reason),
    onSuccess: (res) => {
      toast.success(res.message || "Repeat task rejected");
      setRejectRow(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: repeatTaskApprovalsQueryKey });
    },
    onError: (err) => notifyApiError(err, "Unable to reject"),
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;
  const busyId = approveMutation.isPending ? approveMutation.variables : undefined;

  const columns: DataTableColumn<ApiRepeatTaskApproval>[] = [
    {
      id: "item",
      header: "Item",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.itemLabel || "Item"}</div>
          <div className="text-xs text-muted-foreground">
            Job {row.taskNumber || "—"} · {row.kind === "ADDON" ? "Add-on" : "Package"}
          </div>
        </div>
      ),
    },
    {
      id: "operative",
      header: "Operative",
      cell: (row) => (
        <div>
          <div>{row.operativeName || "—"}</div>
          <div className="text-xs text-muted-foreground">{row.workDate}</div>
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

  const rowActions: DataTableRowAction<ApiRepeatTaskApproval>[] = [
    {
      id: "approve",
      label: "Approve",
      icon: <Check className="h-3.5 w-3.5" />,
      hidden: (row) => !canModify || !row.canApprove,
      onClick: (row) => approveMutation.mutate(row.id),
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

  return (
    <div>
      <PageHeader title="Repeat task approvals" />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={query.isLoading || statusesQuery.isLoading}
        fetching={query.isFetching}
        loadingText="Loading repeat task requests…"
        error={
          query.isError || statusesQuery.isError
            ? {
                title: "Unable to load repeat task approvals",
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
          placeholder: "Search job, item, reason…",
          "aria-label": "Search repeat task approvals",
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
            <SelectContent>
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
            selectedStatus?.code === REPEAT_TASK_STATUS_PENDING
              ? "No pending repeat tasks"
              : "No repeat task requests",
          description: search
            ? "Try clearing the search."
            : "When someone re-assigns a previously used package or add-on, it appears here.",
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
            <h3 className="font-display text-lg font-semibold">Reject this repeat task?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {rejectRow.itemLabel} on job {rejectRow.taskNumber}. No assignment will be created.
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
              placeholder="Why is this repeat rejected?"
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
