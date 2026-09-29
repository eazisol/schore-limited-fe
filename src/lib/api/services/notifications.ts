import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";
import type { PagedResult } from "./users";

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  linkPath: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdDate: string;
}

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  unreadOnly?: boolean;
}

export interface ApiNotificationUnreadCount {
  count: number;
}

export interface ApiNotificationPreference {
  inAppNotificationsEnabled: boolean;
}

export const notificationsQueryKey = ["notifications"] as const;

export const notificationsService = {
  list: (params: NotificationListParams = {}) =>
    http.get<ApiEnvelope<PagedResult<ApiNotification>>>("notifications", {
      params: {
        Page: params.page ?? 1,
        PageSize: params.pageSize ?? 20,
        ...(params.search?.trim() ? { Search: params.search.trim() } : {}),
        ...(params.unreadOnly === true ? { UnreadOnly: true } : {}),
      },
    }),

  unreadCount: () =>
    http.get<ApiEnvelope<ApiNotificationUnreadCount>>("notifications/unread-count"),

  markRead: (id: string) =>
    http.post<ApiEnvelope<ApiNotification>>(`notifications/${id}/read`),

  markAllRead: () => http.post<ApiEnvelope<boolean>>("notifications/read-all"),

  getPreference: () =>
    http.get<ApiEnvelope<ApiNotificationPreference>>("notifications/preference"),

  updatePreference: (inAppNotificationsEnabled: boolean) =>
    http.put<ApiEnvelope<ApiNotificationPreference>>("notifications/preference", {
      inAppNotificationsEnabled,
    }),
};
