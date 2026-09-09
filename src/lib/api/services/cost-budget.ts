import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiCostBudgetCustomer {
  customerId: string;
  customerName: string;
  budget: number;
  spent: number;
  remaining: number;
  overBudgetTaskCount: number;
}

export interface ApiCostBudgetTask {
  taskId: string;
  taskNumber: string;
  propertyId: string;
  propertyName: string;
  customerId: string;
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
  operativeId: string;
  operativeName: string;
  taskId: string;
  taskNumber: string;
  propertyId: string;
  propertyName: string;
  customerId: string | null;
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
  get: (params: { weekEnding?: string; customerId?: string } = {}) =>
    http.get<ApiEnvelope<ApiCostBudget>>("cost-budget", {
      params: {
        ...(params.weekEnding ? { WeekEnding: params.weekEnding } : {}),
        ...(params.customerId != null ? { CustomerId: params.customerId } : {}),
      },
    }),
  getForCustomer: (customerId: string) =>
    http.get<ApiEnvelope<ApiCostBudget>>(`Users/${customerId}/cost-budget`),
  getForDaily: () =>
    http.get<ApiEnvelope<ApiCostBudget>>("DailyProgramme/cost-budget"),
};
