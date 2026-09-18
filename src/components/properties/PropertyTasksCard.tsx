import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Eye, History, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { tasksService, type ApiTask } from "@/lib/api/services/tasks";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { formatDateTime } from "@/lib/module-ui";
import { TASKS_ROUTE } from "@/lib/tasks";
import { DAILY_ROUTE } from "@/lib/daily";
import { isNonEmptyId } from "@/lib/ids";
import { tasksQueryKey } from "@/routes/tasks.index";
import { TaskTimelinePanel } from "@/components/tasks/TaskTimelinePanel";

type PropertyTasksCardProps = {
  propertyId: string;
  propertyName: string;
};

export function PropertyTasksCard({ propertyId, propertyName }: PropertyTasksCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: TASKS_ROUTE, action: "delete" });
  const canReadDaily = usePermission({ route: DAILY_ROUTE, action: "read" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDel, setConfirmDel] = useState<ApiTask | null>(null);
  const [timelineTask, setTimelineTask] = useState<ApiTask | null>(null);
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
    enabled: isNonEmptyId(propertyId),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksService.remove(id),
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
        <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
          {task.taskNumber || "—"}
        </code>
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
      onClick: (task) =>
        navigate({
          to: "/tasks/$id",
          params: { id: task.id },
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
                params: { id: task.id },
                search: {
                  mode: "edit",
                  from: "property",
                  propertyId: String(propertyId),
                },
              }),
          },
        ]
      : []),
    {
      id: "timeline",
      label: "View timeline",
      icon: <History className="h-4 w-4" />,
      onClick: (task) => setTimelineTask(task),
    },
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

  const newJobButton = (
    <Can route={TASKS_ROUTE} action="modify">
      <Button size="sm" className="h-8" asChild>
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
  );

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
        <h3 className="shrink-0 font-display text-base font-semibold tracking-tight">Jobs</h3>
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5 sm:max-w-xs sm:flex-none">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search jobs…"
            className="w-full min-w-0 bg-transparent text-sm outline-none"
            aria-label="Search property jobs"
          />
        </div>
        {isFetching ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
        <div className="ml-auto shrink-0">{newJobButton}</div>
      </div>

      <DataTable
        embedded
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={isLoading}
        fetching={false}
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
          action: !search && canModify ? newJobButton : undefined,
        }}
      />

      <Sheet
        open={Boolean(timelineTask)}
        onOpenChange={(open) => {
          if (!open) setTimelineTask(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-border/70 bg-gradient-to-br from-accent/10 via-background to-background px-5 pb-4 pt-5 pr-12 text-left">
            <div className="flex items-center gap-2.5">
              <span className="inline-grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent">
                <History className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <SheetTitle className="text-base">Job timeline</SheetTitle>
                <SheetDescription className="text-xs">
                  Activity history for {timelineTask?.taskNumber || "this job"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 py-4">
            {timelineTask ? (
              <TaskTimelinePanel
                taskId={String(timelineTask.id)}
                variant="drawer"
                enabled={Boolean(timelineTask)}
                className="h-full"
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {confirmDel ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="card-elevated w-full max-w-md space-y-4 p-6">
            <h3 className="font-display text-lg font-semibold">Delete job?</h3>
            <p className="text-sm text-muted-foreground">
              Soft-delete job{" "}
              <strong>{confirmDel.taskNumber || confirmDel.id}</strong> for{" "}
              <strong>{propertyName || confirmDel.propertyName}</strong>.
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
