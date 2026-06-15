// Sample data for Schore Limited platform — production-feel mocks.

export type Contract = "MS" | "John";
export type Role = "CEO" | "CM" | "PM" | "SM";
export type CIS = "0%" | "20%" | "30%";
export type PropertyStatus = "In Progress" | "Handed Over" | "On Hold" | "Snag";
export type WageStatus = "Draft" | "Pending" | "Approved" | "Refused" | "Paid";

export interface Operative {
  id: string;
  name: string;
  trade: string;
  cis: CIS;
  dailyRate: number;
  phone: string;
  utr: string;
  status: "Active" | "Inactive";
  startDate: string;
}

export interface Property {
  id: string;
  ref: string;
  address: string;
  postcode: string;
  contract: Contract;
  type: "KBWC" | "Bathroom" | "Kitchen" | "Wet Room";
  status: PropertyStatus;
  startDate: string;
  daysOnSite: number;
  heldDays: number;
  budget: number;
  spent: number;
  siteManager: string;
  accessNotes?: string;
}

export interface Allocation {
  id: string;
  date: string;
  propertyId: string;
  operativeId: string;
  code: string; // KF, C2, L, PB, etc.
  description: string;
  time: "AM" | "PM" | "Late AM";
  payType: "Day" | "Price";
  value: number;
  costSplit?: { propertyId: string; amount: number }[];
  status: "Ticked" | "Planned" | "Locked";
}

export interface WageSheet {
  id: string;
  operativeId: string;
  contract: Contract;
  weekEnding: string;
  lines: { property: string; date: string; task: string; amount: number }[];
  gross: number;
  cisRate: number;
  cisTax: number;
  net: number;
  status: WageStatus;
  invoiceNo: string;
}

export interface RateLine {
  id: string;
  trade: string;
  group: string;
  code: string;
  task: string;
  payType: "Day" | "Price";
  rate: number;
  unit?: string;
}

export const operatives: Operative[] = [
  { id: "op-001", name: "Aurelian Popescu", trade: "Carpenter", cis: "20%", dailyRate: 240, phone: "07700 900112", utr: "1234567890", status: "Active", startDate: "2024-03-04" },
  { id: "op-002", name: "Zoltan Miron", trade: "Carpenter", cis: "20%", dailyRate: 240, phone: "07700 900113", utr: "2234567890", status: "Active", startDate: "2023-11-12" },
  { id: "op-003", name: "Vasile Ionescu", trade: "Tiler", cis: "20%", dailyRate: 220, phone: "07700 900114", utr: "3234567890", status: "Active", startDate: "2024-01-22" },
  { id: "op-004", name: "Marius Dragomir", trade: "Plumber", cis: "0%", dailyRate: 260, phone: "07700 900115", utr: "4234567890", status: "Active", startDate: "2022-08-09" },
  { id: "op-005", name: "Andrei Stoica", trade: "Electrician", cis: "20%", dailyRate: 280, phone: "07700 900116", utr: "5234567890", status: "Active", startDate: "2024-05-30" },
  { id: "op-006", name: "Cristian Vlad", trade: "Painter", cis: "30%", dailyRate: 200, phone: "07700 900117", utr: "", status: "Active", startDate: "2025-02-10" },
  { id: "op-007", name: "Bogdan Marin", trade: "Labourer", cis: "20%", dailyRate: 160, phone: "07700 900118", utr: "7234567890", status: "Active", startDate: "2024-09-01" },
  { id: "op-008", name: "Stefan Radu", trade: "Plasterer", cis: "20%", dailyRate: 230, phone: "07700 900119", utr: "8234567890", status: "Inactive", startDate: "2023-04-18" },
];

export const properties: Property[] = [
  { id: "p-101", ref: "30 Wimbourne", address: "30 Wimbourne / Hillhouse Ct", postcode: "SS14 1AA", contract: "MS", type: "KBWC", status: "In Progress", startDate: "2026-01-12", daysOnSite: 6, heldDays: 1, budget: 8200, spent: 4180, siteManager: "Claudiu Ceausu", accessNotes: "Key in office" },
  { id: "p-102", ref: "73 Winifred Rd", address: "73 Winifred Road", postcode: "SS15 5BB", contract: "MS", type: "Kitchen", status: "In Progress", startDate: "2026-01-18", daysOnSite: 4, heldDays: 0, budget: 5600, spent: 3120, siteManager: "Claudiu Ceausu" },
  { id: "p-103", ref: "9 Spencers Ct", address: "9 Spencers Court", postcode: "SS16 6CC", contract: "MS", type: "Bathroom", status: "In Progress", startDate: "2026-01-20", daysOnSite: 3, heldDays: 0, budget: 3200, spent: 1480, siteManager: "Claudiu Ceausu", accessNotes: "Garden access required" },
  { id: "p-104", ref: "3 Ashfield", address: "3 Ashfield", postcode: "SS13 2DD", contract: "John", type: "Wet Room", status: "On Hold", startDate: "2026-01-15", daysOnSite: 5, heldDays: 3, budget: 4400, spent: 2010, siteManager: "Florin Vasile", accessNotes: "Wet walls — awaiting dryer" },
  { id: "p-105", ref: "12 Laindon Link", address: "12 Laindon Link", postcode: "SS15 6EE", contract: "John", type: "KBWC", status: "In Progress", startDate: "2026-01-08", daysOnSite: 9, heldDays: 0, budget: 8200, spent: 6740, siteManager: "Florin Vasile" },
  { id: "p-106", ref: "47 Felmores", address: "47 Felmores", postcode: "SS13 1FF", contract: "MS", type: "Bathroom", status: "Handed Over", startDate: "2025-12-20", daysOnSite: 9, heldDays: 0, budget: 3200, spent: 2980, siteManager: "Claudiu Ceausu" },
  { id: "p-107", ref: "21 Long Riding", address: "21 Long Riding", postcode: "SS14 1GG", contract: "John", type: "Kitchen", status: "Snag", startDate: "2026-01-05", daysOnSite: 11, heldDays: 1, budget: 5600, spent: 5320, siteManager: "Florin Vasile" },
  { id: "p-108", ref: "8 Vange Hill Dr", address: "8 Vange Hill Drive", postcode: "SS16 5HH", contract: "MS", type: "KBWC", status: "In Progress", startDate: "2026-01-22", daysOnSite: 1, heldDays: 0, budget: 8200, spent: 240, siteManager: "Claudiu Ceausu" },
];

export const allocations: Allocation[] = [
  { id: "a-1", date: "2026-01-23", propertyId: "p-101", operativeId: "op-001", code: "KF", description: "Kitchen fit", time: "AM", payType: "Price", value: 280, status: "Ticked" },
  { id: "a-2", date: "2026-01-23", propertyId: "p-102", operativeId: "op-002", code: "KF", description: "Kitchen fit + extra boxing", time: "AM", payType: "Price", value: 300, status: "Ticked" },
  { id: "a-3", date: "2026-01-23", propertyId: "p-103", operativeId: "op-003", code: "T", description: "Tile bathroom walls", time: "PM", payType: "Price", value: 420, status: "Ticked" },
  { id: "a-4", date: "2026-01-23", propertyId: "p-105", operativeId: "op-004", code: "Pl", description: "1st fix plumbing", time: "AM", payType: "Day", value: 260, status: "Ticked" },
  { id: "a-5", date: "2026-01-23", propertyId: "p-105", operativeId: "op-005", code: "E", description: "1st fix electrics", time: "AM", payType: "Day", value: 280, status: "Ticked" },
  { id: "a-6", date: "2026-01-23", propertyId: "p-108", operativeId: "op-007", code: "L", description: "Labour — strip out", time: "AM", payType: "Day", value: 160, status: "Planned" },
  { id: "a-7", date: "2026-01-23", propertyId: "p-104", operativeId: "op-006", code: "hold", description: "Wet walls — drying", time: "AM", payType: "Day", value: 0, status: "Locked" },
];

export const wageSheets: WageSheet[] = [
  {
    id: "ws-001", operativeId: "op-002", contract: "MS", weekEnding: "2026-01-23", invoiceNo: "SCH-2026-014",
    lines: [
      { property: "30 Wimbourne / Hillhouse Ct", date: "19–20/01", task: "KF", amount: 280 },
      { property: "73 Winifred Rd", date: "21/01", task: "KF + Rise & fall worktop", amount: 480 },
      { property: "73 Winifred Rd", date: "22/01", task: "KF + extra boxing", amount: 300 },
      { property: "73 Winifred Rd", date: "22/01", task: "FD / PF Door / Cupboard door + Ds + At", amount: 180 },
      { property: "9 Spencers Ct", date: "23/01", task: "KF / FD", amount: 370 },
      { property: "3 Ashfield", date: "23/01", task: "C2 WC only / PF Door", amount: 90 },
    ],
    gross: 1700, cisRate: 20, cisTax: 340, net: 1360, status: "Pending",
  },
  {
    id: "ws-002", operativeId: "op-001", contract: "MS", weekEnding: "2026-01-23", invoiceNo: "SCH-2026-015",
    lines: [
      { property: "30 Wimbourne", date: "19/01", task: "KF", amount: 240 },
      { property: "73 Winifred Rd", date: "20/01", task: "KF + Extra", amount: 320 },
      { property: "9 Spencers Ct", date: "22/01", task: "C2", amount: 240 },
      { property: "3 Ashfield", date: "23/01", task: "Day rate (no price work)", amount: 240 },
    ],
    gross: 1040, cisRate: 20, cisTax: 208, net: 832, status: "Approved",
  },
  {
    id: "ws-003", operativeId: "op-004", contract: "John", weekEnding: "2026-01-23", invoiceNo: "SCH-2026-016",
    lines: [
      { property: "12 Laindon Link", date: "19–22/01", task: "1st & 2nd fix plumbing", amount: 1040 },
      { property: "21 Long Riding", date: "23/01", task: "Reroute RFH", amount: 320 },
    ],
    gross: 1360, cisRate: 0, cisTax: 0, net: 1360, status: "Draft",
  },
  {
    id: "ws-004", operativeId: "op-003", contract: "MS", weekEnding: "2026-01-23", invoiceNo: "SCH-2026-017",
    lines: [
      { property: "9 Spencers Ct", date: "21–23/01", task: "Bath wall + floor tile", amount: 880 },
    ],
    gross: 880, cisRate: 20, cisTax: 176, net: 704, status: "Refused",
  },
  {
    id: "ws-005", operativeId: "op-005", contract: "John", weekEnding: "2026-01-23", invoiceNo: "SCH-2026-018",
    lines: [
      { property: "12 Laindon Link", date: "19–23/01", task: "Full electrics 1st+2nd fix", amount: 1400 },
    ],
    gross: 1400, cisRate: 20, cisTax: 280, net: 1120, status: "Paid",
  },
];

export const rates: RateLine[] = [
  { id: "r-1", trade: "Carpenter", group: "Kitchen", code: "KF", task: "Kitchen fit (base)", payType: "Price", rate: 240 },
  { id: "r-2", trade: "Carpenter", group: "Kitchen", code: "KF+", task: "KF + Rise & fall worktop", payType: "Price", rate: 480 },
  { id: "r-3", trade: "Carpenter", group: "Doors", code: "FD", task: "Fire door hang & furniture", payType: "Price", rate: 90, unit: "per door" },
  { id: "r-4", trade: "Carpenter", group: "Doors", code: "PF", task: "Pre-finished door", payType: "Price", rate: 70, unit: "per door" },
  { id: "r-5", trade: "Carpenter", group: "Bathroom", code: "C2", task: "C2 bathroom carcass", payType: "Price", rate: 240 },
  { id: "r-6", trade: "Carpenter", group: "Day Rate", code: "Day", task: "Daily rate (floor)", payType: "Day", rate: 240 },
  { id: "r-7", trade: "Tiler", group: "Walls", code: "T-W", task: "Wall tiling", payType: "Price", rate: 28, unit: "per m²" },
  { id: "r-8", trade: "Tiler", group: "Floors", code: "T-F", task: "Floor tiling", payType: "Price", rate: 32, unit: "per m²" },
  { id: "r-9", trade: "Plumber", group: "1st Fix", code: "Pl1", task: "1st fix plumbing", payType: "Day", rate: 260 },
  { id: "r-10", trade: "Plumber", group: "2nd Fix", code: "Pl2", task: "2nd fix plumbing", payType: "Day", rate: 260 },
  { id: "r-11", trade: "Plumber", group: "Heating", code: "RFH", task: "Reroute heating pipes", payType: "Price", rate: 320 },
  { id: "r-12", trade: "Electrician", group: "1st Fix", code: "E1", task: "1st fix electrics", payType: "Day", rate: 280 },
  { id: "r-13", trade: "Electrician", group: "2nd Fix", code: "E2", task: "2nd fix electrics", payType: "Day", rate: 280 },
  { id: "r-14", trade: "Labourer", group: "General", code: "L", task: "General labour", payType: "Day", rate: 160 },
  { id: "r-15", trade: "Painter", group: "Decorate", code: "D", task: "Decorate full unit", payType: "Price", rate: 380 },
  { id: "r-16", trade: "Plasterer", group: "Skim", code: "PB", task: "Plasterboard + skim", payType: "Price", rate: 220, unit: "per board" },
];

export const holdReasons = [
  "No access / refused",
  "Wet walls — drying",
  "No kitchen units in store",
  "Asbestos not removed in time",
  "Awaiting tenant decant",
  "Materials shortage",
];

export const contracts: { id: Contract; client: string; site: string; budget: number; spent: number; prelims: number; properties: number }[] = [
  { id: "MS", client: "MS Housing", site: "Basildon — MS", budget: 142000, spent: 84320, prelims: 12400, properties: 18 },
  { id: "John", client: "John Williams Group", site: "Basildon — John", budget: 96000, spent: 51280, prelims: 7800, properties: 11 },
];

export const fmtGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

export const fmtGBPp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export const getOperative = (id: string) => operatives.find(o => o.id === id);
export const getProperty = (id: string) => properties.find(p => p.id === id);
export const getWageSheet = (id: string) => wageSheets.find(w => w.id === id);
