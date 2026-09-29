import { toast } from "sonner";
import type { ApiMenu } from "@/lib/api/services/auth";
import { canAccessPath, toAppPath } from "@/lib/authorization";

/** Extract pathname from a notification deep link (e.g. `/wages?statementId=x` → `/wages`). */
export function notificationLinkPathname(linkPath: string | null | undefined): string | null {
  const raw = (linkPath ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw, "http://local.invalid");
    return toAppPath(url.pathname);
  } catch {
    const pathOnly = raw.split("?")[0]?.split("#")[0] ?? "";
    return pathOnly ? toAppPath(pathOnly) : null;
  }
}

function parseLink(linkPath: string): URL | null {
  try {
    return new URL(linkPath.trim(), "http://local.invalid");
  } catch {
    return null;
  }
}

function buildDailyFallback(params: URLSearchParams): string {
  const qs = new URLSearchParams();
  const date = params.get("date")?.trim();
  const taskId = params.get("taskId")?.trim();
  const propertyId = params.get("propertyId")?.trim();
  if (date) qs.set("date", date);
  if (taskId) qs.set("taskId", taskId);
  if (propertyId) qs.set("propertyId", propertyId);
  const query = qs.toString();
  return query ? `/daily?${query}` : "/daily";
}

/**
 * Resolves where a notification should navigate.
 * Rate/repeat Approvals links fall back to Daily (with task/date filter) when Approvals access is missing.
 * Returns null when the user cannot open any related destination.
 */
export function resolveNotificationLink(
  menus: ApiMenu[],
  linkPath: string | null | undefined,
): string | null {
  const raw = (linkPath ?? "").trim();
  if (!raw) return null;

  const url = parseLink(raw);
  const pathname = notificationLinkPathname(raw);
  if (!pathname || !url) return null;

  const isApprovals =
    pathname === "/rate-approvals" || pathname.startsWith("/rate-approvals/");

  if (isApprovals) {
    if (canAccessPath(menus, "/rate-approvals")) {
      return raw.startsWith("/") ? raw : `${pathname}${url.search}`;
    }
    if (canAccessPath(menus, "/daily")) {
      return buildDailyFallback(url.searchParams);
    }
    toast.error("You don't have access to open this notification.");
    return null;
  }

  if (canAccessPath(menus, pathname)) {
    return raw.startsWith("/") ? raw : `${pathname}${url.search}`;
  }

  toast.error("You don't have access to open this notification.");
  return null;
}

/**
 * @deprecated Prefer resolveNotificationLink — kept for simple access checks.
 */
export function canOpenNotificationLink(
  menus: ApiMenu[],
  linkPath: string | null | undefined,
): boolean {
  return resolveNotificationLink(menus, linkPath) != null;
}
