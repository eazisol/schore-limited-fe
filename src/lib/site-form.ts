import { z } from "zod";
import type { SitePayload } from "@/lib/api/services/sites";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
} from "@/lib/field-validation";

const optionalAddressField = (label: string, maxLength: number) =>
  z.string().trim().max(maxLength, `${label} must be ${maxLength} characters or fewer`);

export const siteFormSchema = z
  .object({
    name: nameSchema("Name", NAME_MAX_LENGTH),
    code: codeSchema("Code", CODE_MAX_LENGTH),
    description: descriptionSchema(),
    address: optionalAddressField("Address", 500),
    city: optionalAddressField("City", 100),
    state: optionalAddressField("State", 100),
    country: optionalAddressField("Country", 100),
    zipCode: optionalAddressField("ZIP Code", 20),
    customerId: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.customerId.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Client is required",
      });
    }
  });

export type SiteFormValues = z.infer<typeof siteFormSchema>;

export function toSitePayload(values: SiteFormValues): SitePayload {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    description: values.description.trim() || null,
    address: values.address.trim() || null,
    city: values.city.trim() || null,
    state: values.state.trim() || null,
    country: values.country.trim() || null,
    zipCode: values.zipCode.trim() || null,
    customerId: values.customerId,
    isActive: values.isActive,
  };
}

export function siteToFormValues(row: {
  name: string;
  code: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  customerId: string;
  isActive: boolean;
}): SiteFormValues {
  return {
    name: row.name,
    code: row.code,
    description: row.description ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    country: row.country ?? "",
    zipCode: row.zipCode ?? "",
    customerId: String(row.customerId),
    isActive: row.isActive,
  };
}
