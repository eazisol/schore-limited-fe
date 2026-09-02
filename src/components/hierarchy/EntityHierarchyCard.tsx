import { Link, useNavigate, type LinkProps } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Eye, Loader2, Pencil } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppTooltip } from "@/components/AppTooltip";
import { CodeBadge } from "@/components/CodeBadge";
import { ActiveStatusBadge, StatusBadge } from "@/components/StatusBadge";
import { usePermission } from "@/components/Permission";
import { projectsService } from "@/lib/api/services/projects";
import { propertiesService } from "@/lib/api/services/properties";
import { sitesService } from "@/lib/api/services/sites";
import { tasksService } from "@/lib/api/services/tasks";
import {
  buildCustomerHierarchy,
  buildProjectHierarchy,
  buildSiteHierarchy,
  filterTasksForProperties,
  type HierarchyJobNode,
  type HierarchyProjectNode,
  type HierarchyPropertyNode,
  type HierarchySiteNode,
} from "@/lib/entity-hierarchy";
import { DAILY_ROUTE } from "@/lib/daily";
import { PROJECTS_ROUTE } from "@/lib/projects";
import { PROPERTIES_ROUTE } from "@/lib/properties";
import { SITES_ROUTE } from "@/lib/sites";
import { TASKS_ROUTE } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import {
  hierarchyEntityEditSearch,
  hierarchyReturnContextFromCardScope,
  hierarchyReturnSearch,
  hierarchyTaskEditSearch,
  hierarchyTaskViewSearch,
  type HierarchyReturnContext,
} from "@/lib/hierarchy-navigation";
import { asIdString, isNonEmptyId } from "@/lib/ids";

const HIERARCHY_PAGE_SIZE = 500;

type EntityHierarchyCardProps =
  | { scope: "customer"; customerId: string; title?: string }
  | { scope: "site"; siteId: string; customerId: string; title?: string }
  | { scope: "project"; projectId: string; customerId: string; title?: string };

const ROW_TYPE_LABEL = {
  site: "Site",
  project: "Project",
  property: "Property",
  job: "Job",
} as const;

function HierarchyCodeCell({ code }: { code?: string | null }) {
  return <CodeBadge code={code} />;
}

function HierarchyTypeCell({ type }: { type: string }) {
  return <span className="text-xs text-muted-foreground">{type}</span>;
}

function HierarchyActionLink({
  label,
  children,
  ...linkProps
}: {
  label: string;
  children: ReactNode;
} & Pick<LinkProps, "to" | "params" | "search">) {
  return (
    <AppTooltip content={label} asChild>
      <Link
        {...linkProps}
        aria-label={label}
        className="inline-grid h-7 w-7 place-items-center rounded-md hover:bg-accent/40"
      >
        {children}
      </Link>
    </AppTooltip>
  );
}

function HierarchyActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <AppTooltip content={label} asChild>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="inline-grid h-7 w-7 place-items-center rounded-md cursor-pointer hover:bg-accent/40"
      >
        {children}
      </button>
    </AppTooltip>
  );
}

function HierarchyEntityActions({
  to,
  id,
  canModify,
  returnContext,
}: {
  to: "/sites/$id" | "/projects/$id" | "/properties/$id";
  id: string;
  canModify: boolean;
  returnContext: HierarchyReturnContext;
}) {
  const params = { id: String(id) };

  return (
    <div className="flex items-center justify-end -space-x-0.5">
      <HierarchyActionLink
        to={to}
        params={params}
        search={hierarchyReturnSearch(returnContext)}
        label="View"
      >
        <Eye className="h-4 w-4" />
      </HierarchyActionLink>
      {canModify ? (
        <HierarchyActionLink
          to={to}
          params={params}
          search={hierarchyEntityEditSearch(returnContext)}
          label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </HierarchyActionLink>
      ) : null}
    </div>
  );
}

function JobActions({
  node,
  returnContext,
}: {
  node: HierarchyJobNode;
  returnContext: HierarchyReturnContext;
}) {
  const navigate = useNavigate();
  const canModify = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const canReadDaily = usePermission({ route: DAILY_ROUTE, action: "read" });
  const params = { id: String(node.id) };

  return (
    <div className="flex items-center justify-end -space-x-0.5">
      <HierarchyActionLink
        to="/tasks/$id"
        params={params}
        search={hierarchyTaskViewSearch(returnContext)}
        label="View"
      >
        <Eye className="h-4 w-4" />
      </HierarchyActionLink>
      {canModify ? (
        <HierarchyActionLink
          to="/tasks/$id"
          params={params}
          search={hierarchyTaskEditSearch(returnContext)}
          label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </HierarchyActionLink>
      ) : null}
      {canReadDaily ? (
        <HierarchyActionButton
          label="Daily"
          onClick={() =>
            navigate({
              to: "/daily",
              search: { propertyId: String(node.propertyId) },
            })
          }
        >
          <CalendarDays className="h-4 w-4" />
        </HierarchyActionButton>
      ) : null}
    </div>
  );
}

function ExpandToggle({
  open,
  hasChildren,
  onToggle,
  label,
}: {
  open: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  label: string;
}) {
  if (!hasChildren) {
    return <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />;
  }

  return (
    <button
      type="button"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
    </button>
  );
}

function HierarchyNameCell({
  depth,
  open,
  hasChildren,
  onToggle,
  label,
}: {
  depth: number;
  open: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-1"
      style={{ paddingLeft: `${depth}rem` }}
    >
      <ExpandToggle
        open={open}
        hasChildren={hasChildren}
        onToggle={onToggle}
        label={label}
      />
      <div className="min-w-0 truncate text-sm">{label}</div>
    </div>
  );
}

function EmptyChildRow({ depth, message }: { depth: number; message: string }) {
  return (
    <tr className="hover:bg-transparent">
      <td colSpan={5} className="px-5 py-1.5">
        <p
          className="text-xs text-muted-foreground"
          style={{ paddingLeft: `${(depth + 1) * 1 + 1.25}rem` }}
        >
          {message}
        </p>
      </td>
    </tr>
  );
}

function JobRows({
  node,
  depth,
  returnContext,
}: {
  node: HierarchyJobNode;
  depth: number;
  returnContext: HierarchyReturnContext;
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="max-w-0 overflow-hidden px-5 py-1.5 align-middle">
        <div className="min-w-0 truncate text-sm" style={{ paddingLeft: `${depth * 1 + 1.25}rem` }}>
          {node.jobTypeName || "—"}
        </div>
      </td>
      <td className="overflow-hidden px-3 py-1.5 align-middle">
        <HierarchyTypeCell type={ROW_TYPE_LABEL.job} />
      </td>
      <td className="overflow-hidden px-3 py-1.5 align-middle">
        <HierarchyCodeCell code={node.taskNumber} />
      </td>
      <td className="overflow-hidden px-3 py-1.5 align-middle">
        {node.statusName ? <StatusBadge status={node.statusName} /> : "—"}
      </td>
      <td className="overflow-hidden px-5 py-1.5 align-middle">
        <JobActions node={node} returnContext={returnContext} />
      </td>
    </tr>
  );
}

function PropertyRows({
  node,
  depth,
  returnContext,
}: {
  node: HierarchyPropertyNode;
  depth: number;
  returnContext: HierarchyReturnContext;
}) {
  const [open, setOpen] = useState(false);
  const canModify = usePermission({ route: PROPERTIES_ROUTE, action: "modify" });
  const hasChildren = node.children.length > 0;

  return (
    <Fragment>
      <tr className="hover:bg-muted/30">
        <td className="max-w-0 overflow-hidden px-5 py-1.5 align-middle">
          <HierarchyNameCell
            depth={depth}
            open={open}
            hasChildren={hasChildren}
            onToggle={() => setOpen((value) => !value)}
            label={node.name}
          />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <HierarchyTypeCell type={ROW_TYPE_LABEL.property} />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <HierarchyCodeCell />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <ActiveStatusBadge isActive={node.isActive} />
        </td>
        <td className="overflow-hidden px-5 py-1.5 align-middle">
          <HierarchyEntityActions
            to="/properties/$id"
            id={node.id}
            canModify={canModify}
            returnContext={returnContext}
          />
        </td>
      </tr>
      {open && !hasChildren ? (
        <EmptyChildRow depth={depth} message="No jobs linked to this property." />
      ) : null}
      {open
        ? node.children.map((job) => (
            <JobRows key={job.id} node={job} depth={depth + 1} returnContext={returnContext} />
          ))
        : null}
    </Fragment>
  );
}

function ProjectRows({
  node,
  depth,
  returnContext,
}: {
  node: HierarchyProjectNode;
  depth: number;
  returnContext: HierarchyReturnContext;
}) {
  const [open, setOpen] = useState(false);
  const canModify = usePermission({ route: PROJECTS_ROUTE, action: "modify" });
  const hasChildren = node.children.length > 0;

  return (
    <Fragment>
      <tr className="hover:bg-muted/30">
        <td className="max-w-0 overflow-hidden px-5 py-1.5 align-middle">
          <HierarchyNameCell
            depth={depth}
            open={open}
            hasChildren={hasChildren}
            onToggle={() => setOpen((value) => !value)}
            label={node.name}
          />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <HierarchyTypeCell type={ROW_TYPE_LABEL.project} />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <HierarchyCodeCell code={node.code} />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <ActiveStatusBadge isActive={node.isActive} />
        </td>
        <td className="overflow-hidden px-5 py-1.5 align-middle">
          <HierarchyEntityActions
            to="/projects/$id"
            id={node.id}
            canModify={canModify}
            returnContext={returnContext}
          />
        </td>
      </tr>
      {open && !hasChildren ? (
        <EmptyChildRow depth={depth} message="No properties linked to this project." />
      ) : null}
      {open
        ? node.children.map((property) => (
            <PropertyRows key={property.id} node={property} depth={depth + 1} returnContext={returnContext} />
          ))
        : null}
    </Fragment>
  );
}

function SiteRows({
  node,
  returnContext,
}: {
  node: HierarchySiteNode;
  returnContext: HierarchyReturnContext;
}) {
  const [open, setOpen] = useState(false);
  const canModify = usePermission({ route: SITES_ROUTE, action: "modify" });
  const hasChildren = node.children.length > 0;

  return (
    <Fragment>
      <tr className="hover:bg-muted/30">
        <td className="max-w-0 overflow-hidden px-5 py-1.5 align-middle">
          <HierarchyNameCell
            depth={0}
            open={open}
            hasChildren={hasChildren}
            onToggle={() => setOpen((value) => !value)}
            label={node.name}
          />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <HierarchyTypeCell type={ROW_TYPE_LABEL.site} />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <HierarchyCodeCell code={node.code} />
        </td>
        <td className="overflow-hidden px-3 py-1.5 align-middle">
          <ActiveStatusBadge isActive={node.isActive} />
        </td>
        <td className="overflow-hidden px-5 py-1.5 align-middle">
          <HierarchyEntityActions
            to="/sites/$id"
            id={node.id}
            canModify={canModify}
            returnContext={returnContext}
          />
        </td>
      </tr>
      {open && !hasChildren ? (
        <EmptyChildRow depth={0} message="No projects linked to this site." />
      ) : null}
      {open
        ? node.children.map((project) => (
            <ProjectRows key={project.id} node={project} depth={1} returnContext={returnContext} />
          ))
        : null}
    </Fragment>
  );
}

function HierarchyTable({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
      <table className="w-full table-fixed text-sm" style={{ minWidth: "48rem" }}>
        <colgroup>
          <col />
          <col style={{ width: "6rem" }} />
          <col style={{ width: "10rem" }} />
          <col style={{ width: "10rem" }} />
          <col style={{ width: "8rem" }} />
        </colgroup>
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="whitespace-nowrap px-5 py-2 text-left font-medium">Name</th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Type</th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Code</th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Status</th>
            <th className="whitespace-nowrap px-5 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

function useTasksForProperties(customerId: string, properties: { id: string }[]) {
  const id = asIdString(customerId);
  const enabled = isNonEmptyId(id) && properties.length > 0;

  return useQuery({
    queryKey: ["hierarchy", "tasks", id, properties.map((p) => p.id).join(",")],
    queryFn: async () =>
      (
        await tasksService.list({
          customerId: id,
          page: 1,
          pageSize: HIERARCHY_PAGE_SIZE,
          sortBy: "createdDate",
          sortDir: "desc",
        })
      ).data.items,
    enabled,
  });
}

function useCustomerHierarchyData(customerId: string) {
  const id = asIdString(customerId);
  const enabled = isNonEmptyId(id);

  const sitesQuery = useQuery({
    queryKey: ["hierarchy", "customer", id, "sites"],
    queryFn: async () =>
      (await sitesService.list({ customerId: id, page: 1, pageSize: HIERARCHY_PAGE_SIZE })).data.items,
    enabled,
  });

  const projectsQuery = useQuery({
    queryKey: ["hierarchy", "customer", id, "projects"],
    queryFn: async () =>
      (await projectsService.list({ customerId: id, page: 1, pageSize: HIERARCHY_PAGE_SIZE })).data.items,
    enabled,
  });

  const propertiesQuery = useQuery({
    queryKey: ["hierarchy", "customer", id, "properties"],
    queryFn: async () =>
      (
        await propertiesService.list({
          customerId: id,
          page: 1,
          pageSize: HIERARCHY_PAGE_SIZE,
        })
      ).data.items,
    enabled,
  });

  const properties = propertiesQuery.data ?? [];
  const tasksQuery = useTasksForProperties(id, properties);

  const tree = useMemo(() => {
    const tasks = filterTasksForProperties(tasksQuery.data ?? [], properties);
    return buildCustomerHierarchy(
      sitesQuery.data ?? [],
      projectsQuery.data ?? [],
      properties,
      tasks,
    );
  }, [sitesQuery.data, projectsQuery.data, properties, tasksQuery.data]);

  const isLoading =
    sitesQuery.isLoading ||
    projectsQuery.isLoading ||
    propertiesQuery.isLoading ||
    tasksQuery.isLoading;
  const isError =
    sitesQuery.isError ||
    projectsQuery.isError ||
    propertiesQuery.isError ||
    tasksQuery.isError;

  return { tree, isLoading, isError };
}

function useSiteHierarchyData(siteId: string, customerId: string) {
  const sid = asIdString(siteId);
  const cid = asIdString(customerId);
  const enabled = isNonEmptyId(sid);

  const projectsQuery = useQuery({
    queryKey: ["hierarchy", "site", sid, "projects"],
    queryFn: async () =>
      (await projectsService.list({ siteId: sid, page: 1, pageSize: HIERARCHY_PAGE_SIZE })).data.items,
    enabled,
  });

  const propertiesQuery = useQuery({
    queryKey: ["hierarchy", "site", sid, "properties"],
    queryFn: async () =>
      (
        await propertiesService.list({
          siteId: sid,
          page: 1,
          pageSize: HIERARCHY_PAGE_SIZE,
        })
      ).data.items,
    enabled,
  });

  const properties = propertiesQuery.data ?? [];
  const tasksQuery = useTasksForProperties(cid, properties);

  const tree = useMemo(() => {
    const tasks = filterTasksForProperties(tasksQuery.data ?? [], properties);
    return buildSiteHierarchy(projectsQuery.data ?? [], properties, tasks);
  }, [projectsQuery.data, properties, tasksQuery.data]);

  const isLoading =
    projectsQuery.isLoading || propertiesQuery.isLoading || tasksQuery.isLoading;
  const isError =
    projectsQuery.isError || propertiesQuery.isError || tasksQuery.isError;

  return { tree, isLoading, isError };
}

function useProjectHierarchyData(projectId: string, customerId: string) {
  const pid = asIdString(projectId);
  const cid = asIdString(customerId);
  const enabled = isNonEmptyId(pid);

  const propertiesQuery = useQuery({
    queryKey: ["hierarchy", "project", pid, "properties"],
    queryFn: async () =>
      (
        await propertiesService.list({
          projectId: pid,
          page: 1,
          pageSize: HIERARCHY_PAGE_SIZE,
        })
      ).data.items,
    enabled,
  });

  const properties = propertiesQuery.data ?? [];
  const tasksQuery = useTasksForProperties(cid, properties);

  const tree = useMemo(() => {
    const tasks = filterTasksForProperties(tasksQuery.data ?? [], properties);
    return buildProjectHierarchy(properties, tasks);
  }, [properties, tasksQuery.data]);

  return {
    tree,
    isLoading: propertiesQuery.isLoading || tasksQuery.isLoading,
    isError: propertiesQuery.isError || tasksQuery.isError,
  };
}

export function EntityHierarchyCard(props: EntityHierarchyCardProps) {
  const title =
    props.title ??
    (props.scope === "customer"
      ? "Client Work & Locations"
      : props.scope === "site"
        ? "Projects, properties & jobs"
        : "Properties & jobs");

  const returnContext = hierarchyReturnContextFromCardScope(props);

  const customerData = useCustomerHierarchyData(
    props.scope === "customer" ? asIdString(props.customerId) : "",
  );
  const siteData = useSiteHierarchyData(
    props.scope === "site" ? asIdString(props.siteId) : "",
    props.scope === "site" ? asIdString(props.customerId) : "",
  );
  const projectData = useProjectHierarchyData(
    props.scope === "project" ? asIdString(props.projectId) : "",
    props.scope === "project" ? asIdString(props.customerId) : "",
  );

  const { tree, isLoading, isError } =
    props.scope === "customer"
      ? customerData
      : props.scope === "site"
        ? siteData
        : projectData;

  const emptyMessage =
    props.scope === "customer"
      ? "No sites linked to this client yet."
      : props.scope === "site"
        ? "No projects linked to this site yet."
        : "No properties linked to this project yet.";

  return (
    <div className="card-elevated overflow-hidden">
      <div className="border-b px-5 py-3 font-display text-base font-semibold tracking-tight">
        {title}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading hierarchy…
        </div>
      ) : isError ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Unable to load linked records.</p>
      ) : tree.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <HierarchyTable>
          {props.scope === "customer"
            ? (tree as HierarchySiteNode[]).map((site) => (
                <SiteRows key={site.id} node={site} returnContext={returnContext} />
              ))
            : props.scope === "site"
              ? (tree as HierarchyProjectNode[]).map((project) => (
                  <ProjectRows
                    key={project.id}
                    node={project}
                    depth={0}
                    returnContext={returnContext}
                  />
                ))
              : (tree as HierarchyPropertyNode[]).map((property) => (
                  <PropertyRows
                    key={property.id}
                    node={property}
                    depth={0}
                    returnContext={returnContext}
                  />
                ))}
        </HierarchyTable>
      )}
    </div>
  );
}
