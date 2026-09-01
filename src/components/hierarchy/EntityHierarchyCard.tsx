import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, ChevronRight, Eye, Loader2, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActiveStatusBadge, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

const HIERARCHY_PAGE_SIZE = 500;

type EntityHierarchyCardProps =
  | { scope: "customer"; customerId: number; title?: string }
  | { scope: "site"; siteId: number; customerId: number; title?: string }
  | { scope: "project"; projectId: number; customerId: number; title?: string };

type JobNavContext =
  | { from: "customer"; customerId: number }
  | { from: "property"; propertyId: number };

function HierarchyEntityActions({
  to,
  id,
  canModify,
}: {
  to: "/sites/$id" | "/projects/$id" | "/properties/$id";
  id: number;
  canModify: boolean;
}) {
  const params = { id: String(id) };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
        <Link to={to} params={params}>
          <Eye className="h-3.5 w-3.5" />
          View
        </Link>
      </Button>
      {canModify ? (
        <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
          <Link to={to} params={params} search={{ mode: "edit" }}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function JobRow({ node, navContext }: { node: HierarchyJobNode; navContext: JobNavContext }) {
  const navigate = useNavigate();
  const canModify = usePermission({ route: TASKS_ROUTE, action: "modify" });
  const canReadDaily = usePermission({ route: DAILY_ROUTE, action: "read" });
  const params = { id: String(node.id) };
  const taskSearch =
    navContext.from === "customer"
      ? {
          mode: "view" as const,
          from: "customer" as const,
          customerId: String(navContext.customerId),
        }
      : {
          mode: "view" as const,
          from: "property" as const,
          propertyId: String(navContext.propertyId),
        };
  const taskEditSearch =
    navContext.from === "customer"
      ? {
          mode: "edit" as const,
          from: "customer" as const,
          customerId: String(navContext.customerId),
        }
      : {
          mode: "edit" as const,
          from: "property" as const,
          propertyId: String(node.propertyId),
        };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
            {node.taskNumber || "—"}
          </code>
          <span className="ml-2 text-muted-foreground">{node.jobTypeName || "—"}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {node.statusName ? <StatusBadge status={node.statusName} /> : null}
        <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
          <Link to="/tasks/$id" params={params} search={taskSearch}>
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>
        </Button>
        {canModify ? (
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link to="/tasks/$id" params={params} search={taskEditSearch}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
        ) : null}
        {canReadDaily ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() =>
              navigate({
                to: "/daily",
                search: { propertyId: String(node.propertyId) },
              })
            }
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Daily
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PropertyBlock({
  node,
  navContext,
  defaultOpen,
}: {
  node: HierarchyPropertyNode;
  navContext: JobNavContext;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const canModify = usePermission({ route: PROPERTIES_ROUTE, action: "modify" });
  const jobNavContext: JobNavContext =
    navContext.from === "customer"
      ? navContext
      : { from: "property", propertyId: node.id };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-md border border-border/60 bg-background"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 truncate text-sm font-medium">{node.name}</div>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          <ActiveStatusBadge isActive={node.isActive} />
          <HierarchyEntityActions to="/properties/$id" id={node.id} canModify={canModify} />
        </div>
      </div>
      <CollapsibleContent className="space-y-2 border-t border-border/60 px-3 py-2">
        {node.children.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No jobs linked to this property.</p>
        ) : (
          node.children.map((job) => (
            <JobRow key={job.id} node={job} navContext={jobNavContext} />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProjectBlock({
  node,
  navContext,
  defaultOpen,
}: {
  node: HierarchyProjectNode;
  navContext: JobNavContext;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const canModify = usePermission({ route: PROJECTS_ROUTE, action: "modify" });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/70 bg-muted/20">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{node.name}</div>
            <div className="truncate text-xs text-muted-foreground">{node.code}</div>
          </div>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          <ActiveStatusBadge isActive={node.isActive} />
          <HierarchyEntityActions to="/projects/$id" id={node.id} canModify={canModify} />
        </div>
      </div>
      <CollapsibleContent className="space-y-2 border-t border-border/60 px-3 py-2">
        {node.children.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No properties linked to this project.</p>
        ) : (
          node.children.map((property) => (
            <PropertyBlock key={property.id} node={property} navContext={navContext} />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SiteBlock({
  node,
  navContext,
  defaultOpen,
}: {
  node: HierarchySiteNode;
  navContext: JobNavContext;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const canModify = usePermission({ route: SITES_ROUTE, action: "modify" });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{node.name}</div>
            <div className="truncate text-xs text-muted-foreground">{node.code}</div>
          </div>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          <ActiveStatusBadge isActive={node.isActive} />
          <HierarchyEntityActions to="/sites/$id" id={node.id} canModify={canModify} />
        </div>
      </div>
      <CollapsibleContent className="space-y-2 border-t border-border/60 px-3 py-3">
        {node.children.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No projects linked to this site.</p>
        ) : (
          node.children.map((project) => (
            <ProjectBlock key={project.id} node={project} navContext={navContext} />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function useTasksForProperties(customerId: number, properties: { id: number }[]) {
  const enabled =
    Number.isFinite(customerId) &&
    customerId > 0 &&
    properties.length > 0;

  return useQuery({
    queryKey: ["hierarchy", "tasks", customerId, properties.map((p) => p.id).join(",")],
    queryFn: async () =>
      (
        await tasksService.list({
          customerId,
          page: 1,
          pageSize: HIERARCHY_PAGE_SIZE,
          sortBy: "createdDate",
          sortDir: "desc",
        })
      ).data.items,
    enabled,
  });
}

function useCustomerHierarchyData(customerId: number) {
  const enabled = Number.isFinite(customerId) && customerId > 0;

  const sitesQuery = useQuery({
    queryKey: ["hierarchy", "customer", customerId, "sites"],
    queryFn: async () =>
      (await sitesService.list({ customerId, page: 1, pageSize: HIERARCHY_PAGE_SIZE })).data.items,
    enabled,
  });

  const projectsQuery = useQuery({
    queryKey: ["hierarchy", "customer", customerId, "projects"],
    queryFn: async () =>
      (await projectsService.list({ customerId, page: 1, pageSize: HIERARCHY_PAGE_SIZE })).data.items,
    enabled,
  });

  const propertiesQuery = useQuery({
    queryKey: ["hierarchy", "customer", customerId, "properties"],
    queryFn: async () =>
      (
        await propertiesService.list({
          customerId,
          page: 1,
          pageSize: HIERARCHY_PAGE_SIZE,
        })
      ).data.items,
    enabled,
  });

  const properties = propertiesQuery.data ?? [];
  const tasksQuery = useTasksForProperties(customerId, properties);

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

function useSiteHierarchyData(siteId: number, customerId: number) {
  const enabled = Number.isFinite(siteId) && siteId > 0;

  const projectsQuery = useQuery({
    queryKey: ["hierarchy", "site", siteId, "projects"],
    queryFn: async () =>
      (await projectsService.list({ siteId, page: 1, pageSize: HIERARCHY_PAGE_SIZE })).data.items,
    enabled,
  });

  const propertiesQuery = useQuery({
    queryKey: ["hierarchy", "site", siteId, "properties"],
    queryFn: async () =>
      (
        await propertiesService.list({
          siteId,
          page: 1,
          pageSize: HIERARCHY_PAGE_SIZE,
        })
      ).data.items,
    enabled,
  });

  const properties = propertiesQuery.data ?? [];
  const tasksQuery = useTasksForProperties(customerId, properties);

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

function useProjectHierarchyData(projectId: number, customerId: number) {
  const enabled = Number.isFinite(projectId) && projectId > 0;

  const propertiesQuery = useQuery({
    queryKey: ["hierarchy", "project", projectId, "properties"],
    queryFn: async () =>
      (
        await propertiesService.list({
          projectId,
          page: 1,
          pageSize: HIERARCHY_PAGE_SIZE,
        })
      ).data.items,
    enabled,
  });

  const properties = propertiesQuery.data ?? [];
  const tasksQuery = useTasksForProperties(customerId, properties);

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
      ? "Sites, projects, properties & jobs"
      : props.scope === "site"
        ? "Projects, properties & jobs"
        : "Properties & jobs");

  const customerNav: JobNavContext =
    props.scope === "customer"
      ? { from: "customer", customerId: props.customerId }
      : { from: "property", propertyId: 0 };

  const customerData = useCustomerHierarchyData(
    props.scope === "customer" ? props.customerId : 0,
  );
  const siteData = useSiteHierarchyData(
    props.scope === "site" ? props.siteId : 0,
    props.scope === "site" ? props.customerId : 0,
  );
  const projectData = useProjectHierarchyData(
    props.scope === "project" ? props.projectId : 0,
    props.scope === "project" ? props.customerId : 0,
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

  const propertyNavContext: JobNavContext = { from: "property", propertyId: 0 };

  return (
    <div className="card-elevated p-5">
      <h3 className="mb-4 font-display text-base font-semibold tracking-tight">{title}</h3>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading hierarchy…
        </div>
      ) : isError ? (
        <p className="py-4 text-sm text-muted-foreground">Unable to load linked records.</p>
      ) : tree.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : props.scope === "customer" ? (
        <div className={cn("space-y-3")}>
          {(tree as HierarchySiteNode[]).map((site) => (
            <SiteBlock key={site.id} node={site} navContext={customerNav} />
          ))}
        </div>
      ) : props.scope === "site" ? (
        <div className="space-y-3">
          {(tree as HierarchyProjectNode[]).map((project) => (
            <ProjectBlock
              key={project.id}
              node={project}
              navContext={propertyNavContext}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(tree as HierarchyPropertyNode[]).map((property) => (
            <PropertyBlock
              key={property.id}
              node={property}
              navContext={propertyNavContext}
            />
          ))}
        </div>
      )}
    </div>
  );
}
