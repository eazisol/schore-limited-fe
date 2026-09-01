import type { ApiProject } from "@/lib/api/services/projects";
import type { ApiProperty } from "@/lib/api/services/properties";
import type { ApiSite } from "@/lib/api/services/sites";

export type HierarchyPropertyNode = {
  kind: "property";
  id: number;
  name: string;
  isActive: boolean;
};

export type HierarchyProjectNode = {
  kind: "project";
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  children: HierarchyPropertyNode[];
};

export type HierarchySiteNode = {
  kind: "site";
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  children: HierarchyProjectNode[];
};

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const id = key(item);
    const bucket = map.get(id);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(id, [item]);
    }
  }
  return map;
}

function mapProperty(property: ApiProperty): HierarchyPropertyNode {
  return {
    kind: "property",
    id: property.id,
    name: property.propertyName,
    isActive: property.isActive,
  };
}

function mapProject(
  project: ApiProject,
  propertiesByProject: Map<number, ApiProperty[]>,
): HierarchyProjectNode {
  return {
    kind: "project",
    id: project.id,
    name: project.name,
    code: project.code,
    isActive: project.isActive,
    children: (propertiesByProject.get(project.id) ?? []).map(mapProperty),
  };
}

export function buildCustomerHierarchy(
  sites: ApiSite[],
  projects: ApiProject[],
  properties: ApiProperty[],
): HierarchySiteNode[] {
  const propertiesByProject = groupBy(properties, (p) => p.projectId);
  const projectsBySite = groupBy(projects, (p) => p.siteId);

  return sites.map((site) => ({
    kind: "site" as const,
    id: site.id,
    name: site.name,
    code: site.code,
    isActive: site.isActive,
    children: (projectsBySite.get(site.id) ?? []).map((project) =>
      mapProject(project, propertiesByProject),
    ),
  }));
}

export function buildSiteHierarchy(
  projects: ApiProject[],
  properties: ApiProperty[],
): HierarchyProjectNode[] {
  const propertiesByProject = groupBy(properties, (p) => p.projectId);
  return projects.map((project) => mapProject(project, propertiesByProject));
}

export function buildProjectHierarchy(properties: ApiProperty[]): HierarchyPropertyNode[] {
  return properties.map(mapProperty);
}
