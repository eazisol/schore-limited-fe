import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export type DashboardPeriod = "Daily" | "Weekly" | "Monthly" | "Yearly" | "Custom";

export interface ApiDashboardTaskRow {
  taskId: string;
  taskNumber: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string | null;
  jobTypeName: string;
  startDate: string;
  statusCode: string;
  statusName: string;
  operativesDisplay: string;
}

export interface ApiDashboard {
  period: string;
  fromDate: string;
  toDate: string;
  inProgressCount: number;
  onHoldCount: number;
  /** Completed + Handed Over combined. */
  completedCount: number;
  newTasksCount: number;
  activePropertiesCount: number;
  /** Kept for later — temporarily not shown on dashboard UI. */
  operativesOnSiteCount: number;
  /** Active properties whose planned Hand Over date has already passed. */
  delayedPropertiesCount: number;
  latestInProgressTasks: ApiDashboardTaskRow[];
}

export interface ApiDashboardActivityPoint {
  date: string;
  inProgressCount: number;
  onHoldCount: number;
  completedCount: number;
  newTasksCount: number;
  activePropertiesCount: number;
  delayedPropertiesCount: number;
}

export interface ApiDashboardActivity {
  period: string;
  fromDate: string;
  toDate: string;
  points: ApiDashboardActivityPoint[];
}

export type DashboardQueryParams = {
  period: DashboardPeriod;
  date?: string;
  fromDate?: string;
  toDate?: string;
};

export const dashboardService = {
  get: ({ period, date, fromDate, toDate }: DashboardQueryParams) =>
    http.get<ApiEnvelope<ApiDashboard>>("Dashboard", {
      params: {
        Period: period,
        ...(date ? { Date: date } : {}),
        ...(fromDate ? { FromDate: fromDate } : {}),
        ...(toDate ? { ToDate: toDate } : {}),
      },
    }),
  getActivity: ({ period, date, fromDate, toDate }: DashboardQueryParams) =>
    http.get<ApiEnvelope<ApiDashboardActivity>>("Dashboard/activity", {
      params: {
        Period: period,
        ...(date ? { Date: date } : {}),
        ...(fromDate ? { FromDate: fromDate } : {}),
        ...(toDate ? { ToDate: toDate } : {}),
      },
    }),
};
