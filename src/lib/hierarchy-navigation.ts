import type { NavigateOptions } from "@tanstack/react-router";
import { z } from "zod";
import { isNonEmptyId } from "@/lib/ids";

export const hierarchyReturnSearchSchema = z.object({
  from: z.enum(["customer", "site", "project", "operative"]).optional(),
  customerId: z.string().optional(),
  siteId: z.string().optional(),
  projectId: z.string().optional(),
  operativeId: z.string().optional(),
});

export type HierarchyReturnContext =
  | { from: "customer"; customerId: string }
  | { from: "site"; siteId: string }
  | { from: "project"; projectId: string }
  | { from: "operative"; operativeId: string };

export type HierarchyCardScope =
  | { scope: "customer"; customerId: string }
  | { scope: "site"; siteId: string; customerId: string }
  | { scope: "project"; projectId: string; customerId: string };

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
  if (search.from === "customer" && isNonEmptyId(search.customerId)) {
    return { from: "customer", customerId: search.customerId };
  }
  if (search.from === "site" && isNonEmptyId(search.siteId)) {
    return { from: "site", siteId: search.siteId };
  }
  if (search.from === "project" && isNonEmptyId(search.projectId)) {
    return { from: "project", projectId: search.projectId };
  }
  if (search.from === "operative" && isNonEmptyId(search.operativeId)) {
    return { from: "operative", operativeId: search.operativeId };
  }
  return null;
}

export function hierarchyReturnSearch(ctx: HierarchyReturnContext): Record<string, string> {
  switch (ctx.from) {
    case "customer":
      return { from: "customer", customerId: ctx.customerId };
    case "site":
      return { from: "site", siteId: ctx.siteId };
    case "project":
      return { from: "project", projectId: ctx.projectId };
    case "operative":
      return { from: "operative", operativeId: ctx.operativeId };
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
        customerId: ctx.customerId,
      };
    case "site":
      return {
        mode: "view" as const,
        from: "site" as const,
        siteId: ctx.siteId,
      };
    case "project":
      return {
        mode: "view" as const,
        from: "project" as const,
        projectId: ctx.projectId,
      };
    case "operative":
      return {
        mode: "view" as const,
        from: "operative" as const,
        operativeId: ctx.operativeId,
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
    case "operative":
      return "Back to operative";
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
      return { to: "/customers/$id", params: { id: ctx.customerId } };
    case "site":
      return { to: "/sites/$id", params: { id: ctx.siteId } };
    case "project":
      return { to: "/projects/$id", params: { id: ctx.projectId } };
    case "operative":
      return { to: "/operatives/$id", params: { id: ctx.operativeId } };
  }
}
