import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBadge } from "@/components/CodeBadge";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { usePermission } from "@/components/Permission";
import {
  DataTable,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import {
  HierarchyEntityEditModal,
  type HierarchyEditTarget,
} from "@/components/hierarchy/HierarchyEntityEditModal";
import { sitesService, type ApiSite } from "@/lib/api/services/sites";
import { projectsService, type ApiProject } from "@/lib/api/services/projects";
import { propertiesService, type ApiProperty } from "@/lib/api/services/properties";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { SITES_ROUTE } from "@/lib/sites";
import { PROJECTS_ROUTE } from "@/lib/projects";
import { PROPERTIES_ROUTE } from "@/lib/properties";
import {
  hierarchyReturnContextFromCardScope,
  hierarchyReturnSearch,
} from "@/lib/hierarchy-navigation";
import { asIdString, isNonEmptyId } from "@/lib/ids";
import { truncateWithEllipsis } from "@/lib/module-ui";
import { AppTooltip } from "@/components/AppTooltip";

type WorkTab = "sites" | "projects" | "properties";

type NamedFilter = { id: string; name: string };

type HierarchyWorkTabsProps =
  | { scope: "customer"; customerId: string; title?: string }
  | { scope: "site"; siteId: string; customerId: string; title?: string }
  | { scope: "project"; projectId: string; customerId: string; title?: string };

type DeleteTarget =
  | { kind: "site"; row: ApiSite }
  | { kind: "project"; row: ApiProject }
  | { kind: "property"; row: ApiProperty };

function defaultTabForScope(scope: HierarchyWorkTabsProps["scope"]): WorkTab {
  if (scope === "customer") return "sites";
  if (scope === "site") return "projects";
  return "properties";
}

function tabsForScope(scope: HierarchyWorkTabsProps["scope"]): WorkTab[] {
  if (scope === "customer") return ["sites", "projects", "properties"];
  if (scope === "site") return ["projects", "properties"];
  return ["properties"];
}

const TAB_LABEL: Record<WorkTab, string> = {
  sites: "Sites",
  projects: "Projects",
  properties: "Properties",
};

/** Client / site / project work locations — tabbed DataTables with drill-down filters. */
export function EntityHierarchyCard(props: HierarchyWorkTabsProps) {
  const title =
    props.title ??
    (props.scope === "customer"
      ? "Client Work & Locations"
      : props.scope === "site"
        ? "Projects & properties"
        : "Properties");

  const customerId = asIdString(props.customerId);
  const scopeSiteId = props.scope === "site" ? asIdString(props.siteId) : "";
  const scopeProjectId = props.scope === "project" ? asIdString(props.projectId) : "";

  const availableTabs = tabsForScope(props.scope);
  const [tab, setTab] = useState<WorkTab>(() => defaultTabForScope(props.scope));
  const [siteFilter, setSiteFilter] = useState<NamedFilter | null>(
    props.scope === "site"
      ? { id: asIdString(props.siteId), name: "" }
      : null,
  );
  const [projectFilter, setProjectFilter] = useState<NamedFilter | null>(
    props.scope === "project"
      ? { id: asIdString(props.projectId), name: "" }
      : null,
  );
  const [editTarget, setEditTarget] = useState<HierarchyEditTarget | null>(null);
  const [confirmDel, setConfirmDel] = useState<DeleteTarget | null>(null);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch();

  const returnContext = hierarchyReturnContextFromCardScope(props);
  const qc = useQueryClient();

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["sites"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["properties"] });
    qc.invalidateQueries({ queryKey: ["lookups"] });
    qc.invalidateQueries({ queryKey: ["hierarchy"] });
    qc.invalidateQueries({ queryKey: ["customer-work"] });
  }

  function handleTabChange(next: string) {
    const value = next as WorkTab;
    if (!availableTabs.includes(value)) return;
    setTab(value);
    clearSearch();
    // Manual tab switch shows all records for this scope (clear drill-down).
    if (props.scope === "customer") {
      setSiteFilter(null);
      setProjectFilter(null);
    } else if (props.scope === "site") {
      setProjectFilter(null);
      setSiteFilter({ id: scopeSiteId, name: siteFilter?.name ?? "" });
    }
  }

  function drillIntoSite(site: ApiSite) {
    setSiteFilter({ id: String(site.id), name: site.name });
    setProjectFilter(null);
    clearSearch();
    setTab("projects");
  }

  function drillIntoProject(project: ApiProject) {
    setProjectFilter({ id: String(project.id), name: project.name });
    if (project.siteId) {
      setSiteFilter({
        id: String(project.siteId),
        name: project.siteName?.trim() || siteFilter?.name || "Site",
      });
    }
    clearSearch();
    setTab("properties");
  }

  const deleteMutation = useMutation({
    mutationFn: async (target: DeleteTarget) => {
      if (target.kind === "site") return sitesService.remove(String(target.row.id));
      if (target.kind === "project") return projectsService.remove(String(target.row.id));
      return propertiesService.remove(String(target.row.id));
    },
    onSuccess: (res, target) => {
      const label =
        target.kind === "site"
          ? "Site"
          : target.kind === "project"
            ? "Project"
            : "Property";
      toast.success(res.message || `${label} deleted`);
      setConfirmDel(null);
      invalidateAll();
    },
    onError: (err, target) => {
      const label =
        target.kind === "site"
          ? "site"
          : target.kind === "project"
            ? "project"
            : "property";
      notifyApiError(err, `Failed to delete ${label}`);
    },
  });

  const activeFilterChips: { key: string; label: string; onClear: () => void }[] = [];
  if (props.scope === "customer" && siteFilter && (tab === "projects" || tab === "properties")) {
    activeFilterChips.push({
      key: "site",
      label: `Site: ${siteFilter.name || "Selected"}`,
      onClear: () => {
        setSiteFilter(null);
        setProjectFilter(null);
      },
    });
  }
  if (projectFilter && tab === "properties" && props.scope !== "project") {
    activeFilterChips.push({
      key: "project",
      label: `Project: ${projectFilter.name || "Selected"}`,
      onClear: () => setProjectFilter(null),
    });
  }

  const searchPlaceholder =
    tab === "sites"
      ? "Search sites…"
      : tab === "projects"
        ? "Search projects…"
        : "Search properties…";

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 sm:max-w-xs">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-sm outline-none"
          aria-label={searchPlaceholder}
        />
      </div>
      {availableTabs.length > 1 ? (
        <TabsList className="ml-auto h-9 shrink-0">
          {availableTabs.map((id) => (
            <TabsTrigger key={id} value={id} className="px-2.5 text-xs sm:px-3 sm:text-sm">
              {TAB_LABEL[id]}
            </TabsTrigger>
          ))}
        </TabsList>
      ) : null}
    </div>
  );

  const tableBody =
    tab === "sites" && availableTabs.includes("sites") ? (
      <SitesWorkTable
        customerId={customerId}
        search={search}
        returnContext={returnContext}
        onDrillSite={drillIntoSite}
        onEdit={(id) => setEditTarget({ kind: "site", id })}
        onDelete={(row) => setConfirmDel({ kind: "site", row })}
        onClearSearch={clearSearch}
      />
    ) : tab === "projects" && availableTabs.includes("projects") ? (
      <>
        {activeFilterChips.length > 0 ? (
          <FilterChips chips={activeFilterChips.filter((c) => c.key === "site")} />
        ) : null}
        <ProjectsWorkTable
          key={`projects-${props.scope === "site" ? scopeSiteId : siteFilter?.id ?? "all"}`}
          customerId={customerId}
          siteId={props.scope === "site" ? scopeSiteId : siteFilter?.id}
          search={search}
          returnContext={returnContext}
          onDrillProject={drillIntoProject}
          onEdit={(id) => setEditTarget({ kind: "project", id })}
          onDelete={(row) => setConfirmDel({ kind: "project", row })}
          onClearSearch={clearSearch}
        />
      </>
    ) : (
      <>
        {activeFilterChips.length > 0 ? <FilterChips chips={activeFilterChips} /> : null}
        <PropertiesWorkTable
          key={`properties-${props.scope === "site" ? scopeSiteId : siteFilter?.id ?? ""}-${props.scope === "project" ? scopeProjectId : projectFilter?.id ?? ""}`}
          customerId={customerId}
          siteId={
            props.scope === "site"
              ? scopeSiteId
              : props.scope === "project"
                ? undefined
                : siteFilter?.id
          }
          projectId={props.scope === "project" ? scopeProjectId : projectFilter?.id}
          search={search}
          returnContext={returnContext}
          onEdit={(id) => setEditTarget({ kind: "property", id })}
          onDelete={(row) => setConfirmDel({ kind: "property", row })}
          onClearSearch={clearSearch}
        />
      </>
    );

  return (
    <div className="card-elevated overflow-hidden">
      <div className="border-b px-4 py-2.5 font-display text-base font-semibold tracking-tight">
        {title}
      </div>

      {availableTabs.length > 1 ? (
        <Tabs value={tab} onValueChange={handleTabChange}>
          {toolbar}
          {tableBody}
        </Tabs>
      ) : (
        <>
          {toolbar}
          {tableBody}
        </>
      )}

      {editTarget ? (
        <HierarchyEntityEditModal
          target={editTarget}
          onClose={() => {
            setEditTarget(null);
            invalidateAll();
          }}
        />
      ) : null}

      {confirmDel ? (
        <DeleteConfirmDialog
          target={confirmDel}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => deleteMutation.mutate(confirmDel)}
        />
      ) : null}
    </div>
  );
}

function FilterChips({
  chips,
}: {
  chips: { key: string; label: string; onClear: () => void }[];
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClear}
          className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          {chip.label}
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function DeleteConfirmDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const name =
    target.kind === "property" ? target.row.propertyName : target.row.name;
  const label =
    target.kind === "site" ? "site" : target.kind === "project" ? "project" : "property";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-card p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold">Delete {name}?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This permanently removes the {label} record.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete {label}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SitesWorkTable({
  customerId,
  search,
  returnContext,
  onDrillSite,
  onEdit,
  onDelete,
  onClearSearch,
}: {
  customerId: string;
  search: string;
  returnContext: ReturnType<typeof hierarchyReturnContextFromCardScope>;
  onDrillSite: (site: ApiSite) => void;
  onEdit: (id: string) => void;
  onDelete: (row: ApiSite) => void;
  onClearSearch: () => void;
}) {
  const navigate = useNavigate();
  const canModify = usePermission({ route: SITES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: SITES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const enabled = isNonEmptyId(customerId);
  const query = useQuery({
    queryKey: ["customer-work", "sites", customerId, { page, pageSize, search }],
    queryFn: async () =>
      (await sitesService.list({ customerId, page, pageSize, search })).data,
    enabled,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const columns = useMemo<DataTableColumn<ApiSite>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        truncate: false,
        cell: (item) => (
          <AppTooltip content={`${item.name} — view projects`} asChild align="start">
            <button
              type="button"
              className="inline-block max-w-full cursor-pointer truncate text-left font-medium text-info underline underline-offset-2"
              onClick={() => onDrillSite(item)}
            >
              {truncateWithEllipsis(item.name)}
            </button>
          </AppTooltip>
        ),
      },
      {
        id: "code",
        header: "Code",
        cell: (item) => <CodeBadge code={item.code} />,
      },
      {
        id: "status",
        header: "Status",
        cell: (item) => <ActiveStatusBadge isActive={item.isActive} />,
      },
    ],
    [onDrillSite],
  );

  const rowActions = useMemo<DataTableRowAction<ApiSite>[]>(
    () => [
      {
        id: "view",
        label: "View site",
        icon: <Eye className="h-4 w-4" />,
        onClick: (item) =>
          navigate({
            to: "/sites/$id",
            params: { id: item.id },
            search: hierarchyReturnSearch(returnContext),
          }),
      },
      {
        id: "edit",
        label: "Edit site",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (item) => onEdit(String(item.id)),
      },
      {
        id: "delete",
        label: "Delete site",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (item) => onDelete(item),
      },
    ],
    [canDelete, canModify, navigate, onDelete, onEdit, returnContext],
  );

  return (
    <DataTable
      embedded
      columns={columns}
      rows={rows}
      getRowId={(item) => item.id}
      loading={query.isLoading}
      fetching={query.isFetching}
      loadingText="Loading sites…"
      density="compact"
      error={
        query.isError
          ? {
              title: "Unable to load sites",
              message: (query.error as unknown as ApiError)?.message || "Please try again.",
              onRetry: () => {
                void query.refetch();
              },
            }
          : null
      }
      emptyState={{
        title: "No sites for this client.",
        description: search ? "Try clearing the search." : undefined,
        action: search ? (
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        ) : undefined,
      }}
      rowActions={rowActions}
      pagination={{
        page,
        pageSize,
        totalCount: query.data?.totalCount ?? 0,
        totalPages: query.data?.totalPages ?? 1,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
        itemLabel: "sites",
        disabled: query.isFetching,
        controlsAlign: "center",
      }}
    />
  );
}

function ProjectsWorkTable({
  customerId,
  siteId,
  search,
  returnContext,
  onDrillProject,
  onEdit,
  onDelete,
  onClearSearch,
}: {
  customerId: string;
  siteId?: string;
  search: string;
  returnContext: ReturnType<typeof hierarchyReturnContextFromCardScope>;
  onDrillProject: (project: ApiProject) => void;
  onEdit: (id: string) => void;
  onDelete: (row: ApiProject) => void;
  onClearSearch: () => void;
}) {
  const navigate = useNavigate();
  const canModify = usePermission({ route: PROJECTS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: PROJECTS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, siteId]);

  const enabled = isNonEmptyId(customerId);
  const query = useQuery({
    queryKey: [
      "customer-work",
      "projects",
      customerId,
      { page, pageSize, search, siteId: siteId ?? null },
    ],
    queryFn: async () =>
      (
        await projectsService.list({
          customerId,
          siteId: siteId || undefined,
          page,
          pageSize,
          search,
        })
      ).data,
    enabled,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const columns = useMemo<DataTableColumn<ApiProject>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        truncate: false,
        cell: (item) => (
          <AppTooltip content={`${item.name} — view properties`} asChild align="start">
            <button
              type="button"
              className="inline-block max-w-full cursor-pointer truncate text-left font-medium text-info underline underline-offset-2"
              onClick={() => onDrillProject(item)}
            >
              {truncateWithEllipsis(item.name)}
            </button>
          </AppTooltip>
        ),
      },
      {
        id: "code",
        header: "Code",
        cell: (item) => <CodeBadge code={item.code} />,
      },
      {
        id: "site",
        header: "Site",
        cell: (item) => item.siteName?.trim() || "—",
      },
      {
        id: "status",
        header: "Status",
        cell: (item) => <ActiveStatusBadge isActive={item.isActive} />,
      },
    ],
    [onDrillProject],
  );

  const rowActions = useMemo<DataTableRowAction<ApiProject>[]>(
    () => [
      {
        id: "view",
        label: "View project",
        icon: <Eye className="h-4 w-4" />,
        onClick: (item) =>
          navigate({
            to: "/projects/$id",
            params: { id: item.id },
            search: hierarchyReturnSearch(returnContext),
          }),
      },
      {
        id: "edit",
        label: "Edit project",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (item) => onEdit(String(item.id)),
      },
      {
        id: "delete",
        label: "Delete project",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (item) => onDelete(item),
      },
    ],
    [canDelete, canModify, navigate, onDelete, onEdit, returnContext],
  );

  return (
    <DataTable
      embedded
      columns={columns}
      rows={rows}
      getRowId={(item) => item.id}
      loading={query.isLoading}
      fetching={query.isFetching}
      loadingText="Loading projects…"
      density="compact"
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
      emptyState={{
        title: siteId ? "No projects for this site." : "No projects for this client.",
        description: search ? "Try clearing the search." : undefined,
        action: search ? (
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        ) : undefined,
      }}
      rowActions={rowActions}
      pagination={{
        page,
        pageSize,
        totalCount: query.data?.totalCount ?? 0,
        totalPages: query.data?.totalPages ?? 1,
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
  );
}

function PropertiesWorkTable({
  customerId,
  siteId,
  projectId,
  search,
  returnContext,
  onEdit,
  onDelete,
  onClearSearch,
}: {
  customerId: string;
  siteId?: string;
  projectId?: string;
  search: string;
  returnContext: ReturnType<typeof hierarchyReturnContextFromCardScope>;
  onEdit: (id: string) => void;
  onDelete: (row: ApiProperty) => void;
  onClearSearch: () => void;
}) {
  const navigate = useNavigate();
  const canModify = usePermission({ route: PROPERTIES_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: PROPERTIES_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, siteId, projectId]);

  const enabled = isNonEmptyId(customerId);
  const query = useQuery({
    queryKey: [
      "customer-work",
      "properties",
      customerId,
      { page, pageSize, search, siteId: siteId ?? null, projectId: projectId ?? null },
    ],
    queryFn: async () =>
      (
        await propertiesService.list({
          customerId,
          siteId: siteId || undefined,
          projectId: projectId || undefined,
          page,
          pageSize,
          search,
          sortBy: "createdDate",
          sortDir: "desc",
        })
      ).data,
    enabled,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const columns = useMemo<DataTableColumn<ApiProperty>[]>(
    () => [
      {
        id: "propertyName",
        header: "Property",
        truncate: false,
        cell: (item) => (
          <AppTooltip content={item.propertyName} asChild align="start">
            <button
              type="button"
              className="inline-block max-w-full cursor-pointer truncate text-left font-medium text-info underline underline-offset-2"
              onClick={() =>
                navigate({
                  to: "/properties/$id",
                  params: { id: item.id },
                  search: hierarchyReturnSearch(returnContext),
                })
              }
            >
              {truncateWithEllipsis(item.propertyName)}
            </button>
          </AppTooltip>
        ),
      },
      {
        id: "site",
        header: "Site",
        cell: (item) => item.siteName?.trim() || "—",
      },
      {
        id: "project",
        header: "Project",
        cell: (item) => item.projectName?.trim() || "—",
      },
      {
        id: "status",
        header: "Status",
        cell: (item) => <ActiveStatusBadge isActive={item.isActive} />,
      },
    ],
    [navigate, returnContext],
  );

  const rowActions = useMemo<DataTableRowAction<ApiProperty>[]>(
    () => [
      {
        id: "view",
        label: "View property",
        icon: <Eye className="h-4 w-4" />,
        onClick: (item) =>
          navigate({
            to: "/properties/$id",
            params: { id: item.id },
            search: hierarchyReturnSearch(returnContext),
          }),
      },
      {
        id: "edit",
        label: "Edit property",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (item) => onEdit(String(item.id)),
      },
      {
        id: "delete",
        label: "Delete property",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (item) => onDelete(item),
      },
    ],
    [canDelete, canModify, navigate, onDelete, onEdit, returnContext],
  );

  const emptyTitle = projectId
    ? "No properties for this project."
    : siteId
      ? "No properties for this site."
      : "No properties for this client.";

  return (
    <DataTable
      embedded
      columns={columns}
      rows={rows}
      getRowId={(item) => item.id}
      loading={query.isLoading}
      fetching={query.isFetching}
      loadingText="Loading properties…"
      density="compact"
      error={
        query.isError
          ? {
              title: "Unable to load properties",
              message: (query.error as unknown as ApiError)?.message || "Please try again.",
              onRetry: () => {
                void query.refetch();
              },
            }
          : null
      }
      emptyState={{
        title: emptyTitle,
        description: search ? "Try clearing the search." : undefined,
        action: search ? (
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        ) : undefined,
      }}
      rowActions={rowActions}
      pagination={{
        page,
        pageSize,
        totalCount: query.data?.totalCount ?? 0,
        totalPages: query.data?.totalPages ?? 1,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
        itemLabel: "properties",
        disabled: query.isFetching,
        controlsAlign: "center",
      }}
    />
  );
}
