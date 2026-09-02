import { z } from "zod";
import type { ApiTask, TaskPayload } from "@/lib/api/services/tasks";
import { toDateInputValue } from "@/lib/api/services/users";
import { DESCRIPTION_MAX_LENGTH, descriptionSchema } from "@/lib/field-validation";

export type TaskItemFormValues = {
  id: string;
  operativeId: string;
  workDate: string;
  tradeId: string;
  itemKind: "tradeGroup" | "product";
  tradeGroupId: string;
  productId: string;
  quantity: string;
  doneQty: string;
  rate: string;
  applyRatePermanently: boolean;
  timeSlotId: string;
  isTicked: boolean;
  notes: string;
};

export type TaskFormValues = {
  propertyId: string;
  startDate: string;
  handOverDate: string;
  budget: string;
  jobTypeId: string;
  description: string;
  statusId: string;
  siteManagerId: string;
  /** Filled when Hold status is selected (modal). */
  holdDate: string;
  holdReasonId: string;
  holdNotes: string;
  items: TaskItemFormValues[];
};

export const emptyTaskItem = (): TaskItemFormValues => ({
  id: "",
  operativeId: "",
  workDate: new Date().toISOString().slice(0, 10),
  tradeId: "",
  itemKind: "tradeGroup",
  tradeGroupId: "",
  productId: "",
  quantity: "1",
  doneQty: "0",
  rate: "0",
  applyRatePermanently: false,
  timeSlotId: "",
  isTicked: false,
  notes: "",
});

export const taskFormDefaults: TaskFormValues = {
  propertyId: "",
  startDate: new Date().toISOString().slice(0, 10),
  handOverDate: "",
  budget: "",
  jobTypeId: "",
  description: "",
  statusId: "",
  siteManagerId: "",
  holdDate: "",
  holdReasonId: "",
  holdNotes: "",
  items: [],
};

/** Parse a price like `1000`, `£1,000`, or `1000-2000` / `£1000 - £2000`. */
export function parsePriceInput(raw: string): { min: number; max: number | null } | null {
  const trimmed = raw.trim();
  if (!trimmed) return { min: Number.NaN, max: null };

  const normalized = trimmed.replace(/£/g, "").replace(/,/g, "").trim();
  const rangeMatch = normalized.match(/^(\d+(?:\.\d{1,2})?)\s*[-–—]\s*(\d+(?:\.\d{1,2})?)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0 || max < min) {
      return null;
    }
    return { min, max };
  }

  const singleMatch = normalized.match(/^(\d+(?:\.\d{1,2})?)$/);
  if (singleMatch) {
    const min = Number(singleMatch[1]);
    if (!Number.isFinite(min) || min < 0) return null;
    return { min, max: null };
  }

  return null;
}

export function formatPriceInput(budget: number | null | undefined): string {
  if (budget == null || Number.isNaN(Number(budget))) return "";
  const n = Number(budget);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function formatPriceDisplay(budget: number | null | undefined): string {
  if (budget == null || Number.isNaN(Number(budget))) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(budget));
}

const taskItemSchema = z
  .object({
    id: z.string(),
    operativeId: z.string().min(1, "Operative is required"),
    workDate: z.string().min(1, "Work date is required"),
    tradeId: z.string().min(1, "Trade is required"),
    itemKind: z.enum(["tradeGroup", "product"]),
    tradeGroupId: z.string(),
    productId: z.string(),
    quantity: z.string().min(1, "Quantity is required"),
    doneQty: z.string().min(1, "Done qty is required"),
    rate: z.string().min(1, "Rate is required"),
    applyRatePermanently: z.boolean(),
    timeSlotId: z.string(),
    isTicked: z.boolean(),
    notes: z.string(),
  })
  .superRefine((item, ctx) => {
    if (item.itemKind === "tradeGroup" && !item.tradeGroupId.trim()) {
      ctx.addIssue({ code: "custom", path: ["tradeGroupId"], message: "Trade group is required" });
    }
    if (item.itemKind === "product" && !item.productId.trim()) {
      ctx.addIssue({ code: "custom", path: ["productId"], message: "Product is required" });
    }
    if (item.itemKind === "tradeGroup" && item.tradeGroupId.trim() && !item.productId.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Package product line is required",
      });
    }
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity must be greater than zero",
      });
    }
    const doneQty = Number(item.doneQty);
    if (!Number.isFinite(doneQty) || doneQty < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["doneQty"],
        message: "Done qty cannot be negative",
      });
    } else if (Number.isFinite(qty) && doneQty > qty) {
      ctx.addIssue({
        code: "custom",
        path: ["doneQty"],
        message: "Done qty cannot exceed quantity",
      });
    }
    const rate = Number(item.rate);
    if (!Number.isFinite(rate) || rate < 0) {
      ctx.addIssue({ code: "custom", path: ["rate"], message: "Rate cannot be negative" });
    }
  });

export const taskFormSchema = z
  .object({
    propertyId: z.string().min(1, "Property is required"),
    startDate: z.string().min(1, "Start date is required"),
    handOverDate: z.string(),
    budget: z.string(),
    jobTypeId: z.string().min(1, "Job type is required"),
    description: descriptionSchema(),
    statusId: z.string().min(1, "Status is required"),
    siteManagerId: z.string(),
    holdDate: z.string(),
    holdReasonId: z.string(),
    holdNotes: z.string(),
    items: z.array(taskItemSchema),
  })
  .superRefine((values, ctx) => {
    if (values.handOverDate && values.handOverDate < values.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["handOverDate"],
        message: "Hand over date must be on or after start date",
      });
    }
    if (values.budget.trim()) {
      const parsed = parsePriceInput(values.budget);
      if (!parsed || Number.isNaN(parsed.min)) {
        ctx.addIssue({
          code: "custom",
          path: ["budget"],
          message: "Enter a price like 1000 or a range like 1000-2000",
        });
      }
    }
  });

export function taskToFormValues(task: ApiTask): TaskFormValues {
  return {
    propertyId: String(task.propertyId),
    startDate: toDateInputValue(task.startDate),
    handOverDate: toDateInputValue(task.handOverDate),
    budget: formatPriceInput(task.budget),
    jobTypeId: String(task.jobTypeId),
    description: task.description ?? "",
    statusId: String(task.statusId),
    siteManagerId: task.siteManagerId != null ? String(task.siteManagerId) : "",
    holdDate: "",
    holdReasonId: "",
    holdNotes: "",
    items: (task.items ?? []).map((item) => ({
      id: String(item.id),
      operativeId: String(item.operativeId),
      workDate: toDateInputValue(item.workDate),
      tradeId: String(item.tradeId),
      itemKind:
        item.productId && !item.tradeGroupId
          ? "product"
          : item.tradeGroupId
            ? "tradeGroup"
            : "product",
      tradeGroupId: item.tradeGroupId != null ? String(item.tradeGroupId) : "",
      productId: item.productId != null ? String(item.productId) : "",
      quantity: String(item.quantity),
      doneQty: String(item.doneQty ?? 0),
      rate: String(item.rate),
      applyRatePermanently: false,
      timeSlotId: item.timeSlotId != null ? String(item.timeSlotId) : "",
      isTicked: item.isTicked,
      notes: item.notes ?? "",
    })),
  };
}

export function toTaskPayload(values: TaskFormValues): TaskPayload {
  const holdReasonId = values.holdReasonId.trim() ? values.holdReasonId : null;
  const parsedPrice = values.budget.trim() ? parsePriceInput(values.budget) : null;
  return {
    propertyId: values.propertyId,
    startDate: values.startDate,
    handOverDate: values.handOverDate.trim() || null,
    budget: parsedPrice && !Number.isNaN(parsedPrice.min) ? parsedPrice.min : null,
    jobTypeId: values.jobTypeId,
    description: values.description.trim() || null,
    statusId: values.statusId,
    siteManagerId: values.siteManagerId.trim() ? values.siteManagerId : null,
    holdDate: values.holdDate.trim() || null,
    holdReasonId,
    holdNotes: values.holdNotes.trim() || null,
    items: values.items.map((item) => ({
      id: item.id.trim() ? Number(item.id) : null,
      operativeId: Number(item.operativeId),
      workDate: item.workDate,
      tradeId: Number(item.tradeId),
      tradeGroupId: item.tradeGroupId.trim() ? Number(item.tradeGroupId) : null,
      productId: item.productId.trim() ? Number(item.productId) : null,
      quantity: Number(item.quantity),
      doneQty: Number(item.doneQty),
      rate: Number(item.rate),
      applyRatePermanently: item.applyRatePermanently,
      timeSlotId: item.timeSlotId.trim() ? Number(item.timeSlotId) : null,
      isTicked: item.isTicked,
      notes: item.notes.trim() || null,
    })),
  };
}

export { DESCRIPTION_MAX_LENGTH };
