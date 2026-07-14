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
