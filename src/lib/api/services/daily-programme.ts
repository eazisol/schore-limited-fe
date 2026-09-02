import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiDailyAllocation {
  itemId: string;
  operativeId: string;
  operativeName: string;
  displayName: string;
  tradeCode: string | null;
  tradeName: string | null;
  timeSlotId: string | null;
  timeSlotName: string | null;
  timeSlotCode: string | null;
  notes: string | null;
  isTicked: boolean;
  itemName: string | null;
}

export interface ApiDailyAssignedItemLine {
  itemId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  timeSlotId: string | null;
  timeSlotName: string | null;
  rate: number;
  amount: number;
  workDate: string;
  isToday: boolean;
  isTicked?: boolean;
}

export interface ApiDailyAssignedPackageGroup {
  tradeGroupId: string;
  tradeGroupName: string;
  items: ApiDailyAssignedItemLine[];
}

export interface ApiDailyAssignedOperative {
  operativeId: string;
  operativeName: string;
  packages: ApiDailyAssignedPackageGroup[];
  addOns: ApiDailyAssignedItemLine[];
}

export interface ApiDailyNameOperative {
  operativeId: string;
  operativeName: string;
  items: ApiDailyAssignedItemLine[];
}

export interface ApiDailyAssignedPackage {
  tradeGroupId: string;
  tradeGroupName: string;
  operativeId: string;
  operativeName: string;
  rate: number;
  isCarryOver: boolean;
  hasTodayItems: boolean;
}

export interface ApiDailyUnassignedPackage {
  tradeGroupId: string;
  tradeGroupName: string;
  tradeName: string | null;
}

export interface ApiDailyAssignedAddOn {
  productId: string;
  productName: string;
  operativeId: string;
  operativeName: string;
  rate: number;
  isCarryOver: boolean;
  hasTodayItems: boolean;
}

export interface ApiDailyUnassignedAddOn {
  productId: string;
  productName: string;
}

export interface ApiDailyRow {
  no: number;
  taskId: string;
  taskNumber: string;
  propertyId: string;
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
  assignedPackages: ApiDailyAssignedPackage[];
  unassignedPackages: ApiDailyUnassignedPackage[];
  assignedAddOns: ApiDailyAssignedAddOn[];
  unassignedAddOns: ApiDailyUnassignedAddOn[];
  assignedByOperative: ApiDailyAssignedOperative[];
  nameOperatives: ApiDailyNameOperative[];
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

export type DailyAssignPackagePayload = {
  date: string;
  tradeGroupId: string;
  operativeId: string;
  rate: number;
  quantity: number;
  timeSlotId?: string | null;
  applyRatePermanently?: boolean;
};

export type DailyAssignAddOnPayload = {
  date: string;
  productId: string;
  operativeId: string;
  rate: number;
  quantity: number;
  timeSlotId?: string | null;
  applyRatePermanently?: boolean;
};

export interface DailyProgrammeListParams {
  date: string;
  showHandedOver?: boolean;
  propertyId?: string;
  statusId?: string;
}

export const dailyProgrammeService = {
  get: ({
    date,
    showHandedOver = false,
    propertyId,
    statusId,
  }: DailyProgrammeListParams) =>
    http.get<ApiEnvelope<ApiDailyProgramme>>("DailyProgramme", {
      params: {
        Date: date,
        ShowHandedOver: showHandedOver,
        ...(propertyId != null ? { PropertyId: propertyId } : {}),
        ...(statusId != null ? { StatusId: statusId } : {}),
      },
    }),
  rollForward: (fromDate: string) =>
    http.post<ApiEnvelope<ApiDailyRollForward>>("DailyProgramme/roll-forward", null, {
      params: { fromDate },
    }),
  tick: (itemId: number, date: string) =>
    http.post<ApiEnvelope<ApiDailyAllocation>>(`DailyProgramme/items/${itemId}/tick`, null, {
      params: { date },
    }),
  completeItem: (itemId: number, date: string) =>
    http.post<ApiEnvelope<ApiDailyRow>>(`DailyProgramme/items/${itemId}/complete`, null, {
      params: { date },
    }),
  removeItem: (itemId: number, date: string) =>
    http.post<ApiEnvelope<ApiDailyRow>>(`DailyProgramme/items/${itemId}/remove`, null, {
      params: { date },
    }),
  assignPackage: (taskId: number, payload: DailyAssignPackagePayload) =>
    http.post<ApiEnvelope<ApiDailyRow>>(`DailyProgramme/tasks/${taskId}/assign-package`, payload),
  assignAddOn: (taskId: number, payload: DailyAssignAddOnPayload) =>
    http.post<ApiEnvelope<ApiDailyRow>>(`DailyProgramme/tasks/${taskId}/assign-addon`, payload),
};
