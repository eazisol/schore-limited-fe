import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiPermission {
  id: string | null;
  menuId: string;
  menuName: string | null;
  menuCode: string | null;
  roleId: string;
  roleName: string | null;
  read: boolean;
  modify: boolean;
  delete: boolean;
  createdBy?: number | null;
  createdDate?: string;
  editBy?: number | null;
  editDate?: string | null;
}

export interface UpsertPermission {
  menuId: string;
  read: boolean;
  modify: boolean;
  delete: boolean;
}

export interface AssignRolePermissionsPayload {
  roleId: string;
  permissions: UpsertPermission[];
}

export const permissionsService = {
  getByRole: (roleId: string) =>
    http.get<ApiEnvelope<ApiPermission[]>>(`Permissions/role/${roleId}`),
  assign: (payload: AssignRolePermissionsPayload) =>
    http.post<ApiEnvelope<ApiPermission[]>>("Permissions/assign", payload),
};
