import { z } from "zod";
import type { TradePayload } from "@/lib/api/services/trades";
import {
  codeSchema,
  descriptionSchema,
  nameSchema,
} from "@/lib/field-validation";

export const tradeFormSchema = z.object({
  name: nameSchema(),
  code: codeSchema(),
  description: descriptionSchema(),
  isActive: z.boolean(),
});

export type TradeFormValues = z.infer<typeof tradeFormSchema>;

export function toTradePayload(values: TradeFormValues, orderBy = 0): TradePayload {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    description: values.description.trim(),
    orderBy,
    isActive: values.isActive,
  };
}
