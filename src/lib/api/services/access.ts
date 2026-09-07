import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiAssignedProject {
  id: string;
  name: string;
  code: string;
  siteId: string;
  siteName: string | null;
  customerId: string;
  customerName: string | null;
}

export interface ApiCurrentAccess {
  seesAllProjects: boolean;
  isSiteManager: boolean;
  separateProjectViews: boolean;
  requireProjectSelection: boolean;
  roleCodes: string[];
  capabilities: string[];
  assignedProjects: ApiAssignedProject[];
}

export interface ApiCapabilityDefinition {
  code: string;
  label: string;
  description: string;
  isGranted: boolean;
  isExplicit?: boolean;
}

export interface ApiCapabilitySet {
  roleId?: string | null;
  roleCode?: string | null;
  userId?: string | null;
  capabilities: ApiCapabilityDefinition[];
}

export const accessService = {
  me: () => http.get<ApiEnvelope<ApiCurrentAccess>>("Access/me"),
};

export const capabilitiesService = {
  getByRole: (roleId: string) =>
    http.get<ApiEnvelope<ApiCapabilitySet>>(`Permissions/capabilities/role/${roleId}`),
  assignForRole: (roleId: string, capabilities: { code: string; isGranted: boolean }[]) =>
    http.put<ApiEnvelope<ApiCapabilitySet>>(`Permissions/capabilities/role/${roleId}`, {
      capabilities,
    }),
  getCatalogByRole: (roleId: string) =>
    http.get<ApiEnvelope<ApiCapabilitySet>>(`Users/capability-catalog/${roleId}`),
};
