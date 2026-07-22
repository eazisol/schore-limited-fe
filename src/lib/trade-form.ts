import { z } from "zod";
import type { TradePayload } from "@/lib/api/services/trades";
import {
  codeSchema,
  descriptionSchema,
  nameSchema,
  orderBySchema,
} from "@/lib/field-validation";

export const tradeFormSchema = z.object({
  name: nameSchema(),
  code: codeSchema(),
  description: descriptionSchema(),
  orderBy: orderBySchema(),
  isActive: z.boolean(),
});

export type TradeFormValues = z.infer<typeof tradeFormSchema>;

export function toTradePayload(values: TradeFormValues): TradePayload {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    description: values.description.trim(),
    orderBy: values.orderBy,
    isActive: values.isActive,
  };
}
