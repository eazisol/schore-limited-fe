import { z } from "zod";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { ADDRESS_MAX_LENGTH, descriptionSchema, nameSchema } from "@/lib/field-validation";
import type { PropertyPayload } from "@/lib/api/services/properties";

const CONTACT_FIELD_MAX = 30;
const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePhoneNumber(value: string) {
  if (!value.trim()) return true;
  return !getPhoneLengthError(value.trim(), undefined, { requireMin: true });
}

const phoneField = z.string().trim().superRefine((v, ctx) => {
  if (!v) return;
  if (!validatePhoneNumber(v)) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid phone number for the selected country.",
    });
  }
});

const optionalEmailField = z.string().trim().superRefine((v, ctx) => {
  if (!v) return;
  if (!EMAIL_FORMAT_PATTERN.test(v)) {
    ctx.addIssue({ code: "custom", message: "Enter a valid email address" });
  }
});

function addressFieldsRefine(
  values: {
    address: string;
    zipCode: string;
    city: string;
    state: string;
    country: string;
    contactName: string;
  },
  ctx: z.RefinementCtx,
) {
  const contactName = values.contactName.trim();
  if (!contactName) {
    ctx.addIssue({ code: "custom", path: ["contactName"], message: "Contact name is required" });
  } else if (contactName.length < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["contactName"],
      message: "Contact name must be at least 2 characters",
    });
  } else if (contactName.length > CONTACT_FIELD_MAX) {
    ctx.addIssue({
      code: "custom",
      path: ["contactName"],
      message: `Contact name must be ${CONTACT_FIELD_MAX} characters or fewer`,
    });
  }

  const address = values.address.trim();
  if (!address) {
    ctx.addIssue({ code: "custom", path: ["address"], message: "Address is required" });
  } else if (address.length > ADDRESS_MAX_LENGTH) {
    ctx.addIssue({
      code: "custom",
      path: ["address"],
      message: `Address must be ${ADDRESS_MAX_LENGTH} characters or fewer`,
    });
  }

  const optionalAddressFields = [
    { key: "city" as const, label: "City", max: 100 },
    { key: "state" as const, label: "State", max: 100 },
    { key: "country" as const, label: "Country", max: 100 },
    { key: "zipCode" as const, label: "ZIP Code", max: 20 },
  ];

  for (const { key, label, max } of optionalAddressFields) {
    const value = values[key].trim();
    if (value && value.length > max) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${label} must be ${max} characters or fewer`,
      });
    }
  }
}

export const propertyFormSchema = z
  .object({
    propertyName: nameSchema("Property name"),
    contactName: z.string(),
    contactPhoneNo: phoneField,
    contactEmail: optionalEmailField,
    address: z.string(),
    zipCode: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    accessNotes: descriptionSchema(),
    customerId: z.string(),
    siteId: z.string(),
    projectId: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    addressFieldsRefine(values, ctx);
    if (!values.customerId.trim()) {
      ctx.addIssue({ code: "custom", path: ["customerId"], message: "Client is required" });
    }
    if (!values.siteId.trim()) {
      ctx.addIssue({ code: "custom", path: ["siteId"], message: "Site is required" });
    }
    if (!values.projectId.trim()) {
      ctx.addIssue({ code: "custom", path: ["projectId"], message: "Project is required" });
    }
  });

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export const propertyFormDefaults: PropertyFormValues = {
  propertyName: "",
  contactName: "",
  contactPhoneNo: "",
  contactEmail: "",
  address: "",
  zipCode: "",
  city: "",
  state: "",
  country: "",
  accessNotes: "",
  customerId: "",
  siteId: "",
  projectId: "",
  isActive: true,
};

function requiredId(value: string): string {
  return value.trim();
}

export function toPropertyPayload(values: PropertyFormValues): PropertyPayload {
  return {
    reference: null,
    propertyName: values.propertyName.trim(),
    contactName: values.contactName.trim(),
    contactPhoneNo: values.contactPhoneNo.trim() || null,
    contactEmail: values.contactEmail.trim() || null,
    address: values.address.trim(),
    zipCode: values.zipCode.trim() || null,
    city: values.city.trim() || null,
    state: values.state.trim() || null,
    country: values.country.trim() || null,
    accessNotes: values.accessNotes.trim() || null,
    customerId: requiredId(values.customerId),
    siteId: requiredId(values.siteId),
    projectId: requiredId(values.projectId),
    isActive: values.isActive,
  };
}

export function propertyToFormValues(row: {
  propertyName: string;
  contactName: string;
  contactPhoneNo?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  accessNotes?: string | null;
  customerId: string;
  siteId: string;
  projectId: string;
  isActive: boolean;
}): PropertyFormValues {
  return {
    propertyName: row.propertyName,
    contactName: row.contactName,
    contactPhoneNo: row.contactPhoneNo ?? "",
    contactEmail: row.contactEmail ?? "",
    address: row.address ?? "",
    zipCode: row.zipCode ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    country: row.country ?? "",
    accessNotes: row.accessNotes ?? "",
    customerId: String(row.customerId),
    siteId: String(row.siteId),
    projectId: String(row.projectId),
    isActive: row.isActive,
  };
}
