import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiCostBudgetCustomer {
  customerId: number;
  customerName: string;
  budget: number;
  spent: number;
  remaining: number;
  overBudgetTaskCount: number;
}

export interface ApiCostBudgetTask {
  taskId: number;
  taskNumber: string;
  propertyId: number;
  propertyName: string;
  customerId: number;
  customerName: string | null;
  budget: number | null;
  priceWork: number;
  topUpShare: number;
  spent: number;
  remaining: number | null;
  isOverBudget: boolean;
}

export interface ApiCostBudgetLedgerLine {
  workDate: string;
  operativeId: number;
  operativeName: string;
  taskId: number;
  taskNumber: string;
  propertyId: number;
  propertyName: string;
  customerId: number;
  customerName: string | null;
  priceWork: number;
  topUpShare: number;
  cost: number;
}

export interface ApiCostBudget {
  weekEnding: string | null;
  weekStart: string | null;
  overBudgetCount: number;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  customers: ApiCostBudgetCustomer[];
  tasks: ApiCostBudgetTask[];
  ledger: ApiCostBudgetLedgerLine[];
}

export const costBudgetService = {
  get: (params: { weekEnding?: string; customerId?: number } = {}) =>
    http.get<ApiEnvelope<ApiCostBudget>>("cost-budget", {
      params: {
        ...(params.weekEnding ? { WeekEnding: params.weekEnding } : {}),
        ...(params.customerId != null ? { CustomerId: params.customerId } : {}),
      },
    }),
  getForCustomer: (customerId: number | string) =>
    http.get<ApiEnvelope<ApiCostBudget>>(`Users/${customerId}/cost-budget`),
  getForDaily: () =>
    http.get<ApiEnvelope<ApiCostBudget>>("DailyProgramme/cost-budget"),
};
