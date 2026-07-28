import { z } from "zod";
import {
  codeSchema,
  descriptionSchema,
  nameSchema,
} from "@/lib/field-validation";
import type { TradeGroupPayload } from "@/lib/api/services/trade-groups";

const NOTES_MAX_LENGTH = 500;

const quantitySchema = z.coerce
  .number({ invalid_type_error: "Quantity must be a number" })
  .gt(0, "Quantity must be greater than 0")
  .refine((value) => Number.isFinite(value), "Quantity must be a valid number");

export const tradeGroupItemFormSchema = z.object({
  id: z.string(),
  productId: z.string().min(1, "Product is required"),
  productName: z.string(),
  quantity: z.string().min(1, "Quantity is required"),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH, `Notes must be ${NOTES_MAX_LENGTH} characters or fewer`),
});

export const tradeGroupFormSchema = z
  .object({
    tradeId: z.string(),
    name: nameSchema(),
    code: codeSchema(),
    description: descriptionSchema(),
    isActive: z.boolean(),
    items: z.array(tradeGroupItemFormSchema),
  })
  .superRefine((values, ctx) => {
    if (!values.tradeId.trim()) {
      ctx.addIssue({ code: "custom", path: ["tradeId"], message: "Trade is required" });
    }

    values.items.forEach((item, index) => {
      if (!item.productId.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "productId"],
          message: "Product is required",
        });
      }

      const qty = quantitySchema.safeParse(item.quantity);
      if (!qty.success) {
        for (const issue of qty.error.issues) {
          ctx.addIssue({ ...issue, path: ["items", index, "quantity"] });
        }
      }
    });
  });

export type TradeGroupFormValues = z.infer<typeof tradeGroupFormSchema>;
export type TradeGroupItemFormValues = z.infer<typeof tradeGroupItemFormSchema>;

export function emptyTradeGroupItem(): TradeGroupItemFormValues {
  return {
    id: "",
    productId: "",
    productName: "",
    quantity: "1",
    notes: "",
  };
}

export const tradeGroupFormDefaults: TradeGroupFormValues = {
  tradeId: "",
  name: "",
  code: "",
  description: "",
  isActive: true,
  items: [emptyTradeGroupItem()],
};

export function toTradeGroupPayload(
  values: TradeGroupFormValues,
  orderBy = 0,
): TradeGroupPayload {
  return {
    tradeId: Number(values.tradeId),
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    description: values.description.trim(),
    orderBy,
    isActive: values.isActive,
    items: values.items.map((item, index) => ({
      id: item.id.trim() ? Number(item.id) : null,
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      orderBy: index,
      notes: item.notes.trim() || null,
    })),
  };
}
