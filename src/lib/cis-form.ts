import { z } from "zod";
import type { CisStatusPayload } from "@/lib/api/services/cis";
import {
  codeSchema,
  descriptionSchema,
  nameSchema,
  orderBySchema,
  rateSchema,
} from "@/lib/field-validation";

export const cisFormSchema = z.object({
  name: nameSchema(),
  code: codeSchema(),
  rate: rateSchema(),
  description: descriptionSchema(),
  orderBy: orderBySchema(),
  isActive: z.boolean(),
});

export type CisFormValues = z.infer<typeof cisFormSchema>;

export function toCisPayload(values: CisFormValues): CisStatusPayload {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    rate: values.rate,
    description: values.description.trim(),
    orderBy: values.orderBy,
    isActive: values.isActive,
  };
}
