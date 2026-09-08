import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Download, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import { Form, SubmitButton, SwitchField, SearchableSelect } from "@/components/form";
import { ProjectFormFields } from "@/components/projects/ProjectFormFields";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  downloadCsv,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { projectsService, type ApiProject } from "@/lib/api/services/projects";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { PROJECTS_ROUTE } from "@/lib/projects";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import {
  emptyProjectFormValues,
  projectFormSchema,
  toProjectPayload,
  type ProjectFormValues,
} from "@/lib/project-form";
import { useRateCapReasonGate } from "@/components/rates/useRateCapReasonGate";

export const Route = createFileRoute("/projects/")({
  head: () => ({ meta: [{ title: "Projects | Schore" }] }),
  component: ProjectsList,
});

export const projectsQueryKey = ["projects"] as const;
const lookupsKey = ["lookups", "projects"] as const;

function ProjectsList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canModify = usePermission({ route: PROJECTS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: PROJECTS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<ApiProject | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const query = useQuery({
    queryKey: [...projectsQueryKey, { page, pageSize, search, customerId }],
    queryFn: async () =>
      (
        await projectsService.list({
          page,
          pageSize,
          search,
          customerId,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;
  const hasActiveFilters = Boolean(search || customerId != null);

  function clearFilters() {
    clearSearch();
    setCustomerId(undefined);
    setCustomerLabel(null);
    setPage(1);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || "Project deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: projectsQueryKey });
      qc.invalidateQueries({ queryKey: lookupsKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete project"),
  });

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning("No projects to export for the current page.");
      return;
    }
    setExporting(true);
    try {
      downloadCsv({
        filename: `projects-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Code", "Site", "Client", "Status"],
        rows: rows.map((item) => [
          item.name,
          item.code,
          item.siteName ?? "",
          item.customerName ?? "",
          item.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(`Exported ${rows.length} project${rows.length === 1 ? "" : "s"} to CSV`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiProject>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessor: (item) => item.name,
        cell: (item) => (
          <button
            type="button"
            className="font-medium text-left text-info cursor-pointer"
            onClick={() => navigate({ to: "/projects/$id", params: { id: item.id } })}
          >
            {item.name}
          </button>
        ),
      },
      {
        id: "code",
        header: "Code",
        cell: (item) => (
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">{item.code}</code>
        ),
      },
      {
        id: "site",
        header: "Site",
        cell: (item) => item.siteName ?? "—",
      },
      {
        id: "customer",
        header: "Client",
        cell: (item) => item.customerName ?? "—",
      },
      {
        id: "status",
        header: "Status",
        cell: (item) => <ActiveStatusBadge isActive={item.isActive} />,
      },
    ],
    [navigate],
  );

  const rowActions = useMemo<DataTableRowAction<ApiProject>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (item) => navigate({ to: "/projects/$id", params: { id: item.id } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (item) =>
          navigate({
            to: "/projects/$id",
            params: { id: item.id },
            search: { mode: "edit" },
          }),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (item) => setConfirmDel(item),
      },
    ],
    [canDelete, canModify, navigate],
  );

  return (
    <div>
      <PageHeader
        title="Projects"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || query.isLoading}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export CSV
            </Button>
            <Can route={PROJECTS_ROUTE} action="modify">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Add project
              </Button>
            </Can>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(item) => item.id}
        loading={query.isLoading}
        fetching={query.isFetching}
        loadingText="Loading projects…"
        error={
          query.isError
            ? {
                title: "Unable to load projects",
                message: (query.error as unknown as ApiError)?.message || "Please try again.",
                onRetry: () => {
                  void query.refetch();
                },
              }
            : null
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Search by name or code…",
          "aria-label": "Search projects",
        }}
        filters={
          <SearchableSelect
            value={customerId != null ? String(customerId) : ""}
            onValueChange={(value) => {
              setCustomerId(value ? Number(value) : undefined);
              if (!value) setCustomerLabel(null);
              setPage(1);
            }}
            onSelect={(option) => {
              setCustomerLabel(option.value ? option.label : null);
            }}
            placeholder="All clients"
            searchPlaceholder="Search clients…"
            aria-label="Filter by client"
            queryKey={["users", "customers", "dropdown"]}
            fetchOptions={fetchCustomerOptions}
            selectedLabel={customerLabel}
            emptyOption={{ value: "", label: "All clients" }}
            className="w-full min-w-[11rem] sm:w-52"
            triggerClassName="h-9 [&>span]:whitespace-nowrap"
          />
        }
        emptyState={{
          title: "No projects found.",
          description: hasActiveFilters ? "Try clearing the search or filters." : undefined,
          action: hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined,
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
          itemLabel: "projects",
          disabled: query.isFetching,
          controlsAlign: "center",
        }}
      />

      {createOpen ? (
        <ProjectCreateModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: projectsQueryKey });
            qc.invalidateQueries({ queryKey: lookupsKey });
          }}
        />
      ) : null}

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmDel(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">
              Delete project “{confirmDel.name}”?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDel(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDel.id)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCreateModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { runWithCapReason, modal: capReasonModal } = useRateCapReasonGate();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: emptyProjectFormValues,
  });

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toProjectPayload>) => projectsService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || "Project created");
      onSaved();
    },
  });

  return (
    <>
    <Form
      form={form}
      onSubmit={async (values) => {
        try {
          await runWithCapReason(values, (next) => mutation.mutateAsync(toProjectPayload(next)));
        } catch (err) {
          notifyApiError(err, "Failed to save project");
        }
      }}
      className="contents"
    >
      <Modal
        open
        onClose={onClose}
        title="Add project"
        size="md"
        showCloseButton={false}
        headerActions={<SwitchField<ProjectFormValues> name="isActive" label="Active" />}
      >
        <div className="space-y-3">
          <ProjectFormFields />
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton size="sm" loadingText="Saving…">
              Create project
            </SubmitButton>
          </div>
        </div>
      </Modal>
    </Form>
    {capReasonModal}
    </>
  );
}
