import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarDays, Eye, Pencil, Plus } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { tasksService, type ApiTask } from "@/lib/api/services/tasks";
import type { ApiError } from "@/lib/api/axios";
import { formatDateTime, truncateWithEllipsis } from "@/lib/module-ui";
import { TASKS_ROUTE } from "@/lib/tasks";
import { DAILY_ROUTE } from "@/lib/daily";
import { tasksQueryKey } from "@/routes/tasks.index";

type PropertyTasksCardProps = {
  propertyId: number;
  propertyName: string;
};

export function PropertyTasksCard({ propertyId, propertyName }: PropertyTasksCardProps) {
  const navigate = useNavigate();
  const canModify = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const canReadDaily = usePermission({ route: DAILY_ROUTE, action: "read" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { searchInput, setSearchInput, search } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...tasksQueryKey, "property", propertyId, { page, pageSize, search }],
    queryFn: async () =>
      (
        await tasksService.list({
          page,
          pageSize,
          search,
          propertyId,
          sortBy: "createdDate",
          sortDir: "desc",
        })
      ).data,
    enabled: Number.isFinite(propertyId) && propertyId > 0,
    placeholderData: keepPreviousData,
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const columns: DataTableColumn<ApiTask>[] = [
    {
      id: "taskNumber",
      header: "Job #",
      cell: (task) => (
        <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
          {task.taskNumber || "—"}
        </code>
      ),
    },
    {
      id: "jobType",
      header: "Job type",
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
      onClick: (task) =>
        navigate({
          to: "/tasks/$id",
          params: { id: String(task.id) },
          search: {
            mode: "view",
            from: "property",
            propertyId: String(propertyId),
          },
        }),
    },
    ...(canModify
      ? [
          {
            id: "update",
            label: "Update",
            icon: <Pencil className="h-4 w-4" />,
            onClick: (task: ApiTask) =>
              navigate({
                to: "/tasks/$id",
                params: { id: String(task.id) },
                search: {
                  mode: "edit",
                  from: "property",
                  propertyId: String(propertyId),
                },
              }),
          },
        ]
      : []),
    ...(canReadDaily
      ? [
          {
            id: "daily",
            label: "Open in Daily Programmer",
            icon: <CalendarDays className="h-4 w-4" />,
            onClick: () =>
              navigate({
                to: "/daily",
                search: { propertyId: String(propertyId) },
              }),
          },
        ]
      : []),
  ];

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-tight">Jobs</h3>
        </div>
        <Can route={TASKS_ROUTE} action="modify">
          <Button size="sm" asChild>
            <Link
              to="/tasks/new"
              search={{
                from: "property",
                propertyId: String(propertyId),
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              New job
            </Link>
          </Button>
        </Can>
      </div>

      <div className="p-4 sm:p-5">
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
                  message:
                    (error as unknown as ApiError)?.message || "Please try again.",
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
            "aria-label": "Search property jobs",
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
            controlsAlign: "center",
          }}
          rowActions={rowActions}
          emptyState={{
            title: search ? "No matching jobs" : "No jobs for this property",
            description: search
              ? "Try a different search."
              : "Create a job against this property to allocate work.",
            action:
              !search && canModify ? (
                <Button size="sm" asChild>
                  <Link
                    to="/tasks/new"
                    search={{
                      from: "property",
                      propertyId: String(propertyId),
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    New job
                  </Link>
                </Button>
              ) : undefined,
          }}
        />
      </div>
    </div>
  );
}
