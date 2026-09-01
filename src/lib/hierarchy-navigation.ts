import type { NavigateOptions } from "@tanstack/react-router";
import { z } from "zod";

export const hierarchyReturnSearchSchema = z.object({
  from: z.enum(["customer", "site", "project"]).optional(),
  customerId: z.string().optional(),
  siteId: z.string().optional(),
  projectId: z.string().optional(),
});

export type HierarchyReturnContext =
  | { from: "customer"; customerId: number }
  | { from: "site"; siteId: number }
  | { from: "project"; projectId: number };

export type HierarchyCardScope =
  | { scope: "customer"; customerId: number }
  | { scope: "site"; siteId: number; customerId: number }
  | { scope: "project"; projectId: number; customerId: number };

export function hierarchyReturnContextFromCardScope(
  props: HierarchyCardScope,
): HierarchyReturnContext {
  if (props.scope === "customer") {
    return { from: "customer", customerId: props.customerId };
  }
  if (props.scope === "site") {
    return { from: "site", siteId: props.siteId };
  }
  return { from: "project", projectId: props.projectId };
}

export function parseHierarchyReturnSearch(
  search: z.infer<typeof hierarchyReturnSearchSchema>,
): HierarchyReturnContext | null {
  if (search.from === "customer" && search.customerId) {
    const customerId = Number(search.customerId);
    return Number.isFinite(customerId) && customerId > 0
      ? { from: "customer", customerId }
      : null;
  }
  if (search.from === "site" && search.siteId) {
    const siteId = Number(search.siteId);
    return Number.isFinite(siteId) && siteId > 0 ? { from: "site", siteId } : null;
  }
  if (search.from === "project" && search.projectId) {
    const projectId = Number(search.projectId);
    return Number.isFinite(projectId) && projectId > 0
      ? { from: "project", projectId }
      : null;
  }
  return null;
}

export function hierarchyReturnSearch(ctx: HierarchyReturnContext): Record<string, string> {
  switch (ctx.from) {
    case "customer":
      return { from: "customer", customerId: String(ctx.customerId) };
    case "site":
      return { from: "site", siteId: String(ctx.siteId) };
    case "project":
      return { from: "project", projectId: String(ctx.projectId) };
  }
}

export function hierarchyEntityEditSearch(ctx: HierarchyReturnContext) {
  return { mode: "edit" as const, ...hierarchyReturnSearch(ctx) };
}

export function hierarchyTaskViewSearch(ctx: HierarchyReturnContext) {
  switch (ctx.from) {
    case "customer":
      return {
        mode: "view" as const,
        from: "customer" as const,
        customerId: String(ctx.customerId),
      };
    case "site":
      return {
        mode: "view" as const,
        from: "site" as const,
        siteId: String(ctx.siteId),
      };
    case "project":
      return {
        mode: "view" as const,
        from: "project" as const,
        projectId: String(ctx.projectId),
      };
  }
}

export function hierarchyTaskEditSearch(ctx: HierarchyReturnContext) {
  return { ...hierarchyTaskViewSearch(ctx), mode: "edit" as const };
}

export function hierarchyBackLabel(
  ctx: HierarchyReturnContext | null,
  fallback: string,
): string {
  if (!ctx) return fallback;
  switch (ctx.from) {
    case "customer":
      return "Back to client";
    case "site":
      return "Back to site";
    case "project":
      return "Back to project";
  }
}

export function hierarchyBackNavigation(
  ctx: HierarchyReturnContext | null,
  fallbackTo: "/sites" | "/projects" | "/properties",
): NavigateOptions {
  if (!ctx) {
    return { to: fallbackTo };
  }
  switch (ctx.from) {
    case "customer":
      return { to: "/customers/$id", params: { id: String(ctx.customerId) } };
    case "site":
      return { to: "/sites/$id", params: { id: String(ctx.siteId) } };
    case "project":
      return { to: "/projects/$id", params: { id: String(ctx.projectId) } };
  }
}
