import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiCostBudgetContractor {
  contractorId: number;
  contractorName: string;
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
  contractorId: number | null;
  contractorName: string | null;
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
  contractorId: number | null;
  contractorName: string | null;
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
  contractors: ApiCostBudgetContractor[];
  tasks: ApiCostBudgetTask[];
  ledger: ApiCostBudgetLedgerLine[];
}

export const costBudgetService = {
  get: (params: { weekEnding?: string; contractorId?: number } = {}) =>
    http.get<ApiEnvelope<ApiCostBudget>>("cost-budget", {
      params: {
        ...(params.weekEnding ? { WeekEnding: params.weekEnding } : {}),
        ...(params.contractorId != null ? { ContractorId: params.contractorId } : {}),
      },
    }),
  getForContractor: (contractorId: number | string) =>
    http.get<ApiEnvelope<ApiCostBudget>>(`Users/${contractorId}/cost-budget`),
  getForDaily: () =>
    http.get<ApiEnvelope<ApiCostBudget>>("DailyProgramme/cost-budget"),
};
