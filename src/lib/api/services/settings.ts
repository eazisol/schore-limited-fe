import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiSetting {
  id: number;
  settingKey: string;
  settingValue: string;
  isActive: boolean;
  createdBy?: number | null;
  createdDate?: string;
  editBy?: number | null;
  editDate?: string | null;
}

export interface CreateSettingPayload {
  settingKey: string;
  settingValue: string;
  isActive: boolean;
}

export interface UpdateSettingPayload {
  settingValue: string;
  isActive: boolean;
}

export const EMAIL_SETTING_KEY = "EMAIL";

export interface EmailSettingValue {
  Host: string;
  Port: number;
  Username: string;
  Password: string;
  FromEmail: string;
  FromName: string;
  EnableSsl: boolean;
}

export const settingsService = {
  list: () => http.get<ApiEnvelope<ApiSetting[]>>("Settings"),
  get: (id: number | string) =>
    http.get<ApiEnvelope<ApiSetting>>(`Settings/${id}`),
  create: (payload: CreateSettingPayload) =>
    http.post<ApiEnvelope<ApiSetting>>("Settings", payload),
  update: (id: number | string, payload: UpdateSettingPayload) =>
    http.put<ApiEnvelope<ApiSetting>>(`Settings/${id}`, payload),
  remove: (id: number | string) =>
    http.delete<ApiEnvelope<null>>(`Settings/${id}`),
};
