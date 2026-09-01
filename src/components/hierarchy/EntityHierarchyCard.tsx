import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Eye, Loader2, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActiveStatusBadge } from "@/components/StatusBadge";
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
import {
  buildCustomerHierarchy,
  buildProjectHierarchy,
  buildSiteHierarchy,
  type HierarchyProjectNode,
  type HierarchyPropertyNode,
  type HierarchySiteNode,
} from "@/lib/entity-hierarchy";
import { PROJECTS_ROUTE } from "@/lib/projects";
import { PROPERTIES_ROUTE } from "@/lib/properties";
import { SITES_ROUTE } from "@/lib/sites";
import { cn } from "@/lib/utils";

const HIERARCHY_PAGE_SIZE = 500;

type EntityHierarchyCardProps =
  | { scope: "customer"; customerId: number; title?: string }
  | { scope: "site"; siteId: number; title?: string }
  | { scope: "project"; projectId: number; title?: string };

function HierarchyActions({
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

function PropertyRow({ node }: { node: HierarchyPropertyNode }) {
  const canModify = usePermission({ route: PROPERTIES_ROUTE, action: "modify" });

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{node.name}</div>
      </div>
      <div className="flex items-center gap-2">
        <ActiveStatusBadge isActive={node.isActive} />
        <HierarchyActions to="/properties/$id" id={node.id} canModify={canModify} />
      </div>
    </div>
  );
}

function ProjectBlock({ node, defaultOpen }: { node: HierarchyProjectNode; defaultOpen?: boolean }) {
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
          <HierarchyActions to="/projects/$id" id={node.id} canModify={canModify} />
        </div>
      </div>
      <CollapsibleContent className="space-y-2 border-t border-border/60 px-3 py-2">
        {node.children.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No properties linked to this project.</p>
        ) : (
          node.children.map((property) => <PropertyRow key={property.id} node={property} />)
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SiteBlock({ node, defaultOpen }: { node: HierarchySiteNode; defaultOpen?: boolean }) {
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
          <HierarchyActions to="/sites/$id" id={node.id} canModify={canModify} />
        </div>
      </div>
      <CollapsibleContent className="space-y-2 border-t border-border/60 px-3 py-3">
        {node.children.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No projects linked to this site.</p>
        ) : (
          node.children.map((project) => (
            <ProjectBlock key={project.id} node={project} />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
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

  const tree = useMemo(
    () =>
      buildCustomerHierarchy(
        sitesQuery.data ?? [],
        projectsQuery.data ?? [],
        propertiesQuery.data ?? [],
      ),
    [sitesQuery.data, projectsQuery.data, propertiesQuery.data],
  );

  const isLoading = sitesQuery.isLoading || projectsQuery.isLoading || propertiesQuery.isLoading;
  const isError = sitesQuery.isError || projectsQuery.isError || propertiesQuery.isError;

  return { tree, isLoading, isError };
}

function useSiteHierarchyData(siteId: number) {
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

  const tree = useMemo(
    () => buildSiteHierarchy(projectsQuery.data ?? [], propertiesQuery.data ?? []),
    [projectsQuery.data, propertiesQuery.data],
  );

  const isLoading = projectsQuery.isLoading || propertiesQuery.isLoading;
  const isError = projectsQuery.isError || propertiesQuery.isError;

  return { tree, isLoading, isError };
}

function useProjectHierarchyData(projectId: number) {
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

  const tree = useMemo(
    () => buildProjectHierarchy(propertiesQuery.data ?? []),
    [propertiesQuery.data],
  );

  return {
    tree,
    isLoading: propertiesQuery.isLoading,
    isError: propertiesQuery.isError,
  };
}

export function EntityHierarchyCard(props: EntityHierarchyCardProps) {
  const title =
    props.title ??
    (props.scope === "customer"
      ? "Sites, projects & properties"
      : props.scope === "site"
        ? "Projects & properties"
        : "Properties");

  const customerData = useCustomerHierarchyData(
    props.scope === "customer" ? props.customerId : 0,
  );
  const siteData = useSiteHierarchyData(props.scope === "site" ? props.siteId : 0);
  const projectData = useProjectHierarchyData(
    props.scope === "project" ? props.projectId : 0,
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
            <SiteBlock key={site.id} node={site} />
          ))}
        </div>
      ) : props.scope === "site" ? (
        <div className="space-y-3">
          {(tree as HierarchyProjectNode[]).map((project) => (
            <ProjectBlock key={project.id} node={project} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(tree as HierarchyPropertyNode[]).map((property) => (
            <PropertyRow key={property.id} node={property} />
          ))}
        </div>
      )}
    </div>
  );
}
