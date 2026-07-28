import { z } from "zod";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { descriptionSchema, nameSchema } from "@/lib/field-validation";
import type { PropertyPayload } from "@/lib/api/services/properties";

const CONTACT_FIELD_MAX = 30;
const REFERENCE_MAX_LENGTH = 100;
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
  } else if (address.length > CONTACT_FIELD_MAX) {
    ctx.addIssue({
      code: "custom",
      path: ["address"],
      message: `Address must be ${CONTACT_FIELD_MAX} characters or fewer`,
    });
  }

  const optionalAddressFields = [
    { key: "zipCode" as const, label: "Zip code", max: 20 },
    { key: "city" as const, label: "City", max: 100 },
    { key: "state" as const, label: "State", max: 100 },
    { key: "country" as const, label: "Country", max: 100 },
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
    reference: z
      .string()
      .trim()
      .min(1, "Reference is required")
      .max(REFERENCE_MAX_LENGTH, `Reference must be ${REFERENCE_MAX_LENGTH} characters or fewer`),
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
    contractorId: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    addressFieldsRefine(values, ctx);

    if (!values.customerId.trim()) {
      ctx.addIssue({ code: "custom", path: ["customerId"], message: "Customer is required" });
    }
    if (!values.contractorId.trim()) {
      ctx.addIssue({ code: "custom", path: ["contractorId"], message: "Contractor is required" });
    }
  });

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export const propertyFormDefaults: PropertyFormValues = {
  reference: "",
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
  contractorId: "",
  isActive: true,
};

export function toPropertyPayload(values: PropertyFormValues): PropertyPayload {
  return {
    reference: values.reference.trim(),
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
    customerId: Number(values.customerId),
    contractorId: Number(values.contractorId),
    isActive: values.isActive,
  };
}
