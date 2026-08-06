import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiDailyAllocation {
  itemId: number;
  operativeId: number;
  operativeName: string;
  displayName: string;
  tradeCode: string | null;
  tradeName: string | null;
  timeSlotId: number | null;
  timeSlotName: string | null;
  timeSlotCode: string | null;
  notes: string | null;
  isTicked: boolean;
}

export interface ApiDailyRow {
  no: number;
  taskId: number;
  taskNumber: string;
  propertyId: number;
  propertyName: string;
  propertyAddress: string | null;
  accessNotes: string | null;
  contract: string | null;
  postCode: string | null;
  type: string | null;
  startingDate: string;
  handOverDate: string | null;
  daysCount: number;
  heldDaysCount: number;
  statusCode: string;
  statusName: string;
  tradeOrStatus: string;
  previousDayName: string | null;
  nameDisplay: string | null;
  notesDisplay: string | null;
  timeDisplay: string | null;
  isLocked: boolean;
  allocations: ApiDailyAllocation[];
  nextDay: string | null;
}

export interface ApiDailyProgramme {
  date: string;
  lockActive: boolean;
  lockMessage: string | null;
  canRollForward: boolean;
  inProgressCount: number;
  onHoldCount: number;
  operativesOnSiteCount: number;
  rows: ApiDailyRow[];
}

export interface ApiDailyRollForward {
  fromDate: string;
  nextDate: string;
  propertiesCarryingForward: number;
  droppingOffHandedOver: number;
  openHolds: number;
}

export const dailyProgrammeService = {
  get: (date: string, showHandedOver = false) =>
    http.get<ApiEnvelope<ApiDailyProgramme>>("DailyProgramme", {
      params: { Date: date, ShowHandedOver: showHandedOver },
    }),
  rollForward: (fromDate: string) =>
    http.post<ApiEnvelope<ApiDailyRollForward>>("DailyProgramme/roll-forward", null, {
      params: { fromDate },
    }),
  tick: (itemId: number, date: string) =>
    http.post<ApiEnvelope<ApiDailyAllocation>>(`DailyProgramme/items/${itemId}/tick`, null, {
      params: { date },
    }),
};
