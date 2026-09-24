import { http } from "@/lib/api/axios";
import type { ApiCurrentAccess } from "./access";

export interface ApiMenu {
  id: string;
  name: string;
  code: string;
  route: string;
  icon: string | null;
  parentMenuId: string | null;
  orderBy: number;
  read: boolean;
  modify: boolean;
  delete: boolean;
  children: ApiMenu[];
}

export interface ApiLoginData {
  token: string;
  expiresAt: string;
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  userTypeId?: number;
  userTypeCode?: string;
  roles: string[];
  menus: ApiMenu[];
  access?: ApiCurrentAccess;
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

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const authService = {
  login: (payload: LoginPayload) =>
    http.post<ApiEnvelope<ApiLoginData>>("Auth/login", payload),
  forgotPassword: (payload: ForgotPasswordPayload) =>
    http.post<ApiEnvelope<null>>("Auth/forgot-password", payload),
  resetPassword: (payload: ResetPasswordPayload) =>
    http.post<ApiEnvelope<null>>("Auth/reset-password", payload),
  changePassword: (payload: ChangePasswordPayload) =>
    http.post<ApiEnvelope<null>>("Auth/change-password", payload),
};
