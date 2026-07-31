import { z } from "zod";
import {
  codeSchema,
  descriptionSchema,
  nameSchema,
} from "@/lib/field-validation";
import type { TradeGroupPayload } from "@/lib/api/services/trade-groups";

export const TRADE_GROUP_ITEM_NOTES_MAX_LENGTH = 70;

const quantitySchema = z.coerce
  .number({ invalid_type_error: "Quantity must be a number" })
  .gt(0, "Quantity must be greater than 0")
  .refine((value) => Number.isFinite(value), "Quantity must be a valid number");

const priceSchema = z.coerce
  .number({ invalid_type_error: "Price must be a number" })
  .gte(0, "Price must be 0 or greater")
  .refine((value) => Number.isFinite(value), "Price must be a valid number");

export const tradeGroupItemFormSchema = z.object({
  id: z.string(),
  productId: z.string().min(1, "Product is required"),
  productName: z.string(),
  productSku: z.string(),
  categoryName: z.string(),
  unitId: z.string(),
  unitName: z.string(),
  quantity: z.string().min(1, "Quantity is required"),
  salePrice: z.string().min(1, "Price is required"),
  notes: z
    .string()
    .trim()
    .max(
      TRADE_GROUP_ITEM_NOTES_MAX_LENGTH,
      `Notes must be ${TRADE_GROUP_ITEM_NOTES_MAX_LENGTH} characters or fewer`,
    ),
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

      if (!item.unitId.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "unitId"],
          message: "Unit is required",
        });
      }

      const qty = quantitySchema.safeParse(item.quantity);
      if (!qty.success) {
        for (const issue of qty.error.issues) {
          ctx.addIssue({ ...issue, path: ["items", index, "quantity"] });
        }
      }

      const price = priceSchema.safeParse(item.salePrice);
      if (!price.success) {
        for (const issue of price.error.issues) {
          ctx.addIssue({ ...issue, path: ["items", index, "salePrice"] });
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
    productSku: "",
    categoryName: "",
    unitId: "",
    unitName: "",
    quantity: "1",
    salePrice: "0",
    notes: "",
  };
}

export const tradeGroupFormDefaults: TradeGroupFormValues = {
  tradeId: "",
  name: "",
  code: "",
  description: "",
  isActive: true,
  items: [],
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
    items: values.items
      .filter((item) => item.productId.trim())
      .map((item, index) => ({
        id: item.id.trim() ? Number(item.id) : null,
        productId: Number(item.productId),
        unitId: item.unitId.trim() ? Number(item.unitId) : null,
        quantity: Number(item.quantity),
        salePrice: Number(item.salePrice),
        orderBy: index,
        notes: item.notes.trim() || null,
      })),
  };
}

export function computeTradeGroupTotalPrice(
  items: TradeGroupItemFormValues[] | undefined,
): number {
  return (items ?? []).reduce((sum, item) => {
    const qty = Number(item.quantity);
    const price = Number(item.salePrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + qty * price;
  }, 0);
}
