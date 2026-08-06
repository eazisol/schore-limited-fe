import { z } from "zod";
import type { ApiTask, TaskPayload } from "@/lib/api/services/tasks";
import { toDateInputValue } from "@/lib/api/services/users";

export type TaskItemFormValues = {
  id: string;
  operativeId: string;
  workDate: string;
  tradeId: string;
  itemKind: "tradeGroup" | "product";
  tradeGroupId: string;
  productId: string;
  quantity: string;
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
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity must be greater than zero" });
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
    description: z.string(),
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
      const budget = Number(values.budget);
      if (!Number.isFinite(budget) || budget < 0) {
        ctx.addIssue({ code: "custom", path: ["budget"], message: "Budget cannot be negative" });
      }
    }
  });

export function taskToFormValues(task: ApiTask): TaskFormValues {
  return {
    propertyId: String(task.propertyId),
    startDate: toDateInputValue(task.startDate),
    handOverDate: toDateInputValue(task.handOverDate),
    budget: task.budget != null ? String(task.budget) : "",
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
      itemKind: item.productId && !item.tradeGroupId ? "product" : item.tradeGroupId ? "tradeGroup" : "product",
      tradeGroupId: item.tradeGroupId != null ? String(item.tradeGroupId) : "",
      productId: item.productId != null ? String(item.productId) : "",
      quantity: String(item.quantity),
      rate: String(item.rate),
      applyRatePermanently: false,
      timeSlotId: item.timeSlotId != null ? String(item.timeSlotId) : "",
      isTicked: item.isTicked,
      notes: item.notes ?? "",
    })),
  };
}

export function toTaskPayload(values: TaskFormValues): TaskPayload {
  const holdReasonId = values.holdReasonId.trim() ? Number(values.holdReasonId) : null;
  return {
    propertyId: Number(values.propertyId),
    startDate: values.startDate,
    handOverDate: values.handOverDate.trim() || null,
    budget: values.budget.trim() ? Number(values.budget) : null,
    jobTypeId: Number(values.jobTypeId),
    description: values.description.trim() || null,
    statusId: Number(values.statusId),
    siteManagerId: values.siteManagerId.trim() ? Number(values.siteManagerId) : null,
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
      rate: Number(item.rate),
      applyRatePermanently: item.applyRatePermanently,
      timeSlotId: item.timeSlotId.trim() ? Number(item.timeSlotId) : null,
      isTicked: item.isTicked,
      notes: item.notes.trim() || null,
    })),
  };
}
