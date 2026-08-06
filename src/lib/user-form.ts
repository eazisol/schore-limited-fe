import { z } from "zod";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { newPasswordSchema } from "@/lib/password";
import { emailSchema, userNameSchema } from "@/lib/user-validation";
import { ADDRESS_MAX_LENGTH } from "@/lib/field-validation";
import type { CreateUserPayload, UpdateUserPayload } from "@/lib/api/services/users";
import type { UserModuleMode } from "@/lib/user-module";
import { USER_TYPE_ID } from "@/lib/user-module";

function parseDobInput(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseDateInput(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function validatePhoneNumber(value: string) {
  if (!value.trim()) return true;
  return !getPhoneLengthError(value.trim(), undefined, { requireMin: true });
}

const phoneField = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    if (!v) return;
    if (!validatePhoneNumber(v)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid phone number for the selected country.",
      });
    }
  });

const dateOfBirthField = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    if (!v) return;
    const d = parseDobInput(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date of birth." });
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d.getTime() > today.getTime()) {
      ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future." });
    }
  });

/** Daily rate: required, ≥ 0, up to 2 decimal places (operative only). */
export const dailyRateSchema = z
  .string()
  .trim()
  .min(1, "Daily rate is required")
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter a valid amount (up to 2 decimal places)",
  })
  .transform((v) => Number(v))
  .refine((n) => n >= 0, { message: "Daily rate cannot be negative" });

export type UserFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
  roleId: string;
  isActive: boolean;
  tradeId: string;
  cisId: string;
  dailyRate: string;
  isDailyRate: boolean;
  contactName: string;
  companyName: string;
  address: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  contractorId: string;
  startDate: string;
  endDate: string;
};

export const emptyUserFormValues: UserFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  dateOfBirth: "",
  roleId: "",
  isActive: true,
  tradeId: "",
  cisId: "",
  dailyRate: "",
  isDailyRate: false,
  contactName: "",
  companyName: "",
  address: "",
  zipCode: "",
  city: "",
  state: "",
  country: "",
  contractorId: "",
  startDate: "",
  endDate: "",
};

function operativeExtrasRefine(values: UserFormValues, ctx: z.RefinementCtx) {
  if (!values.tradeId.trim()) {
    ctx.addIssue({ code: "custom", path: ["tradeId"], message: "Trade is required" });
  }
  if (!values.cisId.trim()) {
    ctx.addIssue({ code: "custom", path: ["cisId"], message: "CIS is required" });
  }
  const parsed = dailyRateSchema.safeParse(values.dailyRate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({ ...issue, path: ["dailyRate"] });
    }
  }
}

function contactModuleExtrasRefine(mode: UserModuleMode, values: UserFormValues, ctx: z.RefinementCtx) {
  const optionalAddressFields = [
    { key: "address" as const, label: "Address", max: ADDRESS_MAX_LENGTH },
    { key: "city" as const, label: "City", max: 100 },
    { key: "state" as const, label: "State", max: 100 },
    { key: "country" as const, label: "Country", max: 100 },
    { key: "zipCode" as const, label: "ZIP Code", max: 20 },
  ];

  if (mode === "contractor") {
    const companyName = values.companyName.trim();
    if (companyName && companyName.length > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Company name must be 100 characters or fewer",
      });
    }
  }

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

function employmentDatesRefine(values: UserFormValues, ctx: z.RefinementCtx) {
  const startDate = values.startDate.trim();
  const endDate = values.endDate.trim();
  const parsedStart = startDate ? parseDateInput(startDate) : null;
  const parsedEnd = endDate ? parseDateInput(endDate) : null;

  if (startDate && !parsedStart) {
    ctx.addIssue({
      code: "custom",
      path: ["startDate"],
      message: "Enter a valid start date.",
    });
  }

  if (endDate && !parsedEnd) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Enter a valid end date.",
    });
  }

  if (parsedStart && parsedEnd && parsedEnd.getTime() < parsedStart.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date cannot be earlier than start date.",
    });
  }
}

const sharedFormFields = {
  firstName: userNameSchema("First name"),
  lastName: userNameSchema("Last name"),
  email: emailSchema(),
  phone: phoneField,
  dateOfBirth: dateOfBirthField,
  isActive: z.boolean(),
  tradeId: z.string(),
  cisId: z.string(),
  dailyRate: z.string(),
  isDailyRate: z.boolean(),
  contactName: z.string(),
  companyName: z.string(),
  address: z.string(),
  zipCode: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  contractorId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
};

function applyModeRefinements<T extends z.ZodTypeAny>(mode: UserModuleMode, schema: T) {
  if (mode === "operative") {
    return schema.superRefine((values: UserFormValues, ctx) => {
      operativeExtrasRefine(values, ctx);
      employmentDatesRefine(values, ctx);
    });
  }

  if (mode === "contractor" || mode === "customer") {
    return schema.superRefine((values: UserFormValues, ctx) => {
      contactModuleExtrasRefine(mode, values, ctx);
    });
  }

  return schema;
}

export function createUserFormSchema(mode: UserModuleMode) {
  const isUser = mode === "user";
  const isOperative = mode === "operative";
  const schema = z.object({
    ...sharedFormFields,
    password: isUser || isOperative ? newPasswordSchema : z.string(),
    roleId: isUser ? z.string().min(1, "Role is required") : z.string(),
  });

  return applyModeRefinements(mode, schema);
}

export function editUserFormSchema(mode: UserModuleMode) {
  const isUser = mode === "user";
  const isOperative = mode === "operative";
  const passwordField =
    isUser || isOperative
      ? z.string().superRefine((value, ctx) => {
          if (!value.trim()) return;
          const parsed = newPasswordSchema.safeParse(value);
          if (parsed.success) return;
          for (const issue of parsed.error.issues) {
            ctx.addIssue({ ...issue, path: [] });
          }
        })
      : z.string();

  const schema = z.object({
    ...sharedFormFields,
    password: passwordField,
    roleId: isUser ? z.string().min(1, "Role is required") : z.string(),
  });

  return applyModeRefinements(mode, schema);
}

function parseDailyRate(value: string): number {
  const parsed = dailyRateSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : 0;
}

function applyContactPayload(
  payload: CreateUserPayload | UpdateUserPayload,
  values: UserFormValues,
  mode: UserModuleMode,
) {
  const isCustomer = mode === "customer";
  const isContractor = mode === "contractor";
  payload.contactName =
    isCustomer || isContractor ? values.contactName.trim() || null : values.contactName.trim();
  if (isContractor) {
    payload.companyName = values.companyName.trim() || null;
  }
  payload.address = values.address.trim() || null;
  payload.zipCode = values.zipCode.trim() || null;
  payload.city = values.city.trim() || null;
  payload.state = values.state.trim() || null;
  payload.country = values.country.trim() || null;
}

export function toCreateUserPayload(
  values: UserFormValues,
  mode: UserModuleMode,
): CreateUserPayload {
  const isUser = mode === "user";
  const isOperative = mode === "operative";
  const isContactModule = mode === "contractor" || mode === "customer";
  const isCustomer = mode === "customer";

  const payload: CreateUserPayload = {
    username: values.email.trim(),
    email: values.email.trim(),
    password: isUser || isOperative ? values.password : null,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim() || null,
    dateOfBirth: values.dateOfBirth.trim() || null,
    isActive: values.isActive,
    userTypeId: USER_TYPE_ID[mode],
    roleIds: isUser ? [Number(values.roleId)] : null,
    startDate: isOperative ? values.startDate.trim() || null : null,
    endDate: isOperative ? values.endDate.trim() || null : null,
  };

  if (isOperative) {
    payload.tradeId = Number(values.tradeId);
    payload.cisId = Number(values.cisId);
    payload.dailyRate = parseDailyRate(values.dailyRate);
    payload.isDailyRate = values.isDailyRate;
  }

  if (isContactModule) {
    applyContactPayload(payload, values, mode);
  }

  if (isCustomer) {
    const contractorId = values.contractorId.trim();
    payload.contractorId = contractorId ? Number(contractorId) : null;
  }

  return payload;
}

export function toUpdateUserPayload(
  values: UserFormValues,
  mode: UserModuleMode,
): UpdateUserPayload {
  const isUser = mode === "user";
  const isOperative = mode === "operative";
  const isContactModule = mode === "contractor" || mode === "customer";
  const isCustomer = mode === "customer";
  const nextPassword = values.password.trim();

  const payload: UpdateUserPayload = {
    email: values.email.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim() || null,
    dateOfBirth: values.dateOfBirth.trim() || null,
    isActive: values.isActive,
    userTypeId: USER_TYPE_ID[mode],
    roleIds: isUser ? [Number(values.roleId)] : null,
    password: isUser ? nextPassword || null : isOperative ? nextPassword || null : null,
    startDate: isOperative ? values.startDate.trim() || null : null,
    endDate: isOperative ? values.endDate.trim() || null : null,
  };

  if (isOperative) {
    payload.tradeId = Number(values.tradeId);
    payload.cisId = Number(values.cisId);
    payload.dailyRate = parseDailyRate(values.dailyRate);
    payload.isDailyRate = values.isDailyRate;
  }

  if (isContactModule) {
    applyContactPayload(payload, values, mode);
  }

  if (isCustomer) {
    const contractorId = values.contractorId.trim();
    payload.contractorId = contractorId ? Number(contractorId) : null;
  }

  return payload;
}
