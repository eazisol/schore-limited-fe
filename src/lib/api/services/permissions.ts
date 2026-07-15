import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiPermission {
  id: number;
  menuId: number;
  menuName: string | null;
  menuCode: string | null;
  roleId: number;
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
  menuId: number;
  read: boolean;
  modify: boolean;
  delete: boolean;
}

export interface AssignRolePermissionsPayload {
  roleId: number;
  permissions: UpsertPermission[];
}

export const permissionsService = {
  getByRole: (roleId: number | string) =>
    http.get<ApiEnvelope<ApiPermission[]>>(`Permissions/role/${roleId}`),
  assign: (payload: AssignRolePermissionsPayload) =>
    http.post<ApiEnvelope<ApiPermission[]>>("Permissions/assign", payload),
};
