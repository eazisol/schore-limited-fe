import type { ApiProject } from "@/lib/api/services/projects";
import type { ApiProperty } from "@/lib/api/services/properties";
import type { ApiSite } from "@/lib/api/services/sites";
import type { ApiTask } from "@/lib/api/services/tasks";

export type HierarchyJobNode = {
  kind: "job";
  id: number;
  taskNumber: string;
  jobTypeName: string;
  statusName: string;
  propertyId: number;
};

export type HierarchyPropertyNode = {
  kind: "property";
  id: number;
  name: string;
  isActive: boolean;
  children: HierarchyJobNode[];
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

function mapJob(task: ApiTask): HierarchyJobNode {
  return {
    kind: "job",
    id: task.id,
    taskNumber: task.taskNumber,
    jobTypeName: task.jobTypeName,
    statusName: task.statusName,
    propertyId: task.propertyId,
  };
}

function mapProperty(
  property: ApiProperty,
  tasksByProperty: Map<number, ApiTask[]>,
): HierarchyPropertyNode {
  return {
    kind: "property",
    id: property.id,
    name: property.propertyName,
    isActive: property.isActive,
    children: (tasksByProperty.get(property.id) ?? []).map(mapJob),
  };
}

function mapProject(
  project: ApiProject,
  propertiesByProject: Map<number, ApiProperty[]>,
  tasksByProperty: Map<number, ApiTask[]>,
): HierarchyProjectNode {
  return {
    kind: "project",
    id: project.id,
    name: project.name,
    code: project.code,
    isActive: project.isActive,
    children: (propertiesByProject.get(project.id) ?? []).map((property) =>
      mapProperty(property, tasksByProperty),
    ),
  };
}

export function buildCustomerHierarchy(
  sites: ApiSite[],
  projects: ApiProject[],
  properties: ApiProperty[],
  tasks: ApiTask[],
): HierarchySiteNode[] {
  const propertiesByProject = groupBy(properties, (p) => p.projectId);
  const projectsBySite = groupBy(projects, (p) => p.siteId);
  const tasksByProperty = groupBy(tasks, (t) => t.propertyId);

  return sites.map((site) => ({
    kind: "site" as const,
    id: site.id,
    name: site.name,
    code: site.code,
    isActive: site.isActive,
    children: (projectsBySite.get(site.id) ?? []).map((project) =>
      mapProject(project, propertiesByProject, tasksByProperty),
    ),
  }));
}

export function buildSiteHierarchy(
  projects: ApiProject[],
  properties: ApiProperty[],
  tasks: ApiTask[],
): HierarchyProjectNode[] {
  const propertiesByProject = groupBy(properties, (p) => p.projectId);
  const tasksByProperty = groupBy(tasks, (t) => t.propertyId);
  return projects.map((project) =>
    mapProject(project, propertiesByProject, tasksByProperty),
  );
}

export function buildProjectHierarchy(
  properties: ApiProperty[],
  tasks: ApiTask[],
): HierarchyPropertyNode[] {
  const tasksByProperty = groupBy(tasks, (t) => t.propertyId);
  return properties.map((property) => mapProperty(property, tasksByProperty));
}

/** Keep only tasks whose property is in the loaded property set. */
export function filterTasksForProperties(tasks: ApiTask[], properties: ApiProperty[]): ApiTask[] {
  if (properties.length === 0) return [];
  const propertyIds = new Set(properties.map((p) => p.id));
  return tasks.filter((t) => propertyIds.has(t.propertyId));
}
