import { http } from "@/lib/api/axios";

export interface ApiMenu {
  id: number;
  name: string;
  code: string;
  route: string;
  icon: string | null;
  parentMenuId: number | null;
  orderBy: number;
  read: boolean;
  modify: boolean;
  delete: boolean;
  children: ApiMenu[];
}

export interface ApiLoginData {
  token: string;
  expiresAt: string;
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  menus: ApiMenu[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface LoginPayload {
  emailOrUsername: string;
  password: string;
}

export const authService = {
  login: (payload: LoginPayload) =>
    http.post<ApiEnvelope<ApiLoginData>>("Auth/login", payload),
};
