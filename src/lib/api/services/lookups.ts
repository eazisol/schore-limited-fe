import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiRole {
  id: number;
  name: string;
  code: string;
  description: string | null;
  orderBy: number;
  isActive: boolean;
}

export interface ApiUserType {
  id: number;
  name: string;
  code: string;
  orderBy: number;
  isActive: boolean;
}

export const lookupsService = {
  roles: () => http.get<ApiEnvelope<ApiRole[]>>("Roles"),
  userTypes: () => http.get<ApiEnvelope<ApiUserType[]>>("UserTypes"),
};
