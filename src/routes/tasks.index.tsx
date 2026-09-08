import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { tasksService, type ApiTask } from "@/lib/api/services/tasks";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { formatDateTime, truncateWithEllipsis } from "@/lib/module-ui";
import { TASKS_ROUTE } from "@/lib/tasks";

export const Route = createFileRoute("/tasks/")({
  head: () => ({ meta: [{ title: "Jobs | Schore" }] }),
  component: TasksList,
});

export const tasksQueryKey = ["tasks"] as const;

function TasksList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: TASKS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDel, setConfirmDel] = useState<ApiTask | null>(null);
  const { searchInput, setSearchInput, search } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...tasksQueryKey, { page, pageSize, search }],
    queryFn: async () =>
      (await tasksService.list({ page, pageSize, search, sortBy: "createdDate", sortDir: "desc" }))
        .data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tasksService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Job deleted");
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete job"),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const columns: DataTableColumn<ApiTask>[] = [
    {
      id: "taskNumber",
      header: "Job #",
      cell: (task) => (
        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">
          {task.taskNumber || "—"}
        </code>
      ),
    },
    {
      id: "property",
      header: "Property",
      cell: (task) => (
        <div>
          <div className="font-medium">{truncateWithEllipsis(task.propertyName, 40)}</div>
          {task.propertyAddress ? (
            <div className="text-xs text-muted-foreground">
              {truncateWithEllipsis(task.propertyAddress, 48)}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "jobType",
      header: "Property type",
      cell: (task) => task.jobTypeName || "—",
    },
    {
      id: "startDate",
      header: "Start",
      cell: (task) => task.startDate?.slice(0, 10) || "—",
    },
    {
      id: "handOverDate",
      header: "HO",
      cell: (task) => task.handOverDate?.slice(0, 10) || "—",
    },
    {
      id: "days",
      header: "Days",
      cell: (task) => (
        <span className="font-mono tabular-nums">{task.daysCount ?? 0}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (task) =>
        task.statusName ? <StatusBadge status={task.statusName} /> : "—",
    },
    {
      id: "created",
      header: "Created",
      cell: (task) => formatDateTime(task.createdDate),
    },
  ];

  const rowActions: DataTableRowAction<ApiTask>[] = [
    {
      id: "view",
      label: "View",
      icon: <Eye className="h-4 w-4" />,
      onClick: (task) => navigate({ to: "/tasks/$id", params: { id: task.id } }),
    },
    ...(canModify
      ? [
          {
            id: "edit",
            label: "Edit",
            icon: <Pencil className="h-4 w-4" />,
            onClick: (task: ApiTask) =>
              navigate({
                to: "/tasks/$id",
                params: { id: task.id },
                search: { mode: "edit" },
              }),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            onClick: (task: ApiTask) => setConfirmDel(task),
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Jobs"
        actions={
          <Can route={TASKS_ROUTE} action="modify">
            <Button size="sm" asChild>
              <Link to="/tasks/new">
                <Plus className="mr-1 h-4 w-4" />
                Add job
              </Link>
            </Button>
          </Can>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={isLoading}
        fetching={isFetching}
        loadingText="Loading jobs…"
        error={
          isError
            ? {
                title: "Unable to load jobs",
                message: (error as unknown as ApiError)?.message || "Please try again.",
                onRetry: () => {
                  void refetch();
                },
              }
            : null
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Search jobs…",
          "aria-label": "Search jobs",
        }}
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
          itemLabel: "jobs",
        }}
        rowActions={rowActions}
        emptyState={{
          title: "No jobs yet",
          description: "Create a job against a property to allocate work.",
        }}
      />

      {confirmDel ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="card-elevated w-full max-w-md space-y-4 p-6">
            <h3 className="font-display text-lg font-semibold">Delete job?</h3>
            <p className="text-sm text-muted-foreground">
              Soft-delete job for <strong>{confirmDel.propertyName}</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDel(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDel.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
