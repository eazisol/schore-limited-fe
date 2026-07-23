import { z } from "zod";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { newPasswordSchema } from "@/lib/password";
import { emailSchema, userNameSchema } from "@/lib/user-validation";
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

export function createUserFormSchema(mode: UserModuleMode) {
  const schema = z.object({
    firstName: userNameSchema("First name"),
    lastName: userNameSchema("Last name"),
    email: emailSchema(),
    password: mode === "operative" ? z.string() : newPasswordSchema,
    phone: phoneField,
    dateOfBirth: dateOfBirthField,
    roleId: mode === "operative" ? z.string() : z.string().min(1, "Role is required"),
    isActive: z.boolean(),
    tradeId: z.string(),
    cisId: z.string(),
    dailyRate: z.string(),
  });

  if (mode !== "operative") return schema;
  return schema.superRefine(operativeExtrasRefine);
}

export function editUserFormSchema(mode: UserModuleMode) {
  const passwordField =
    mode === "operative"
      ? z.string()
      : z.string().superRefine((value, ctx) => {
          if (!value.trim()) return;
          const parsed = newPasswordSchema.safeParse(value);
          if (parsed.success) return;
          for (const issue of parsed.error.issues) {
            ctx.addIssue({ ...issue, path: [] });
          }
        });

  const schema = z.object({
    firstName: userNameSchema("First name"),
    lastName: userNameSchema("Last name"),
    email: emailSchema(),
    password: passwordField,
    phone: phoneField,
    dateOfBirth: dateOfBirthField,
    roleId: mode === "operative" ? z.string() : z.string().min(1, "Role is required"),
    isActive: z.boolean(),
    tradeId: z.string(),
    cisId: z.string(),
    dailyRate: z.string(),
  });

  if (mode !== "operative") return schema;
  return schema.superRefine(operativeExtrasRefine);
}

function parseDailyRate(value: string): number {
  const parsed = dailyRateSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : 0;
}

export function toCreateUserPayload(
  values: UserFormValues,
  mode: UserModuleMode,
): CreateUserPayload {
  const isOperative = mode === "operative";
  const payload: CreateUserPayload = {
    username: values.email.trim(),
    email: values.email.trim(),
    password: isOperative ? null : values.password,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim() || null,
    dateOfBirth: values.dateOfBirth.trim() || null,
    isActive: values.isActive,
    userTypeId: USER_TYPE_ID[mode],
    roleIds: isOperative ? null : [Number(values.roleId)],
  };

  if (isOperative) {
    payload.tradeId = Number(values.tradeId);
    payload.cisId = Number(values.cisId);
    payload.dailyRate = parseDailyRate(values.dailyRate);
  }

  return payload;
}

export function toUpdateUserPayload(
  values: UserFormValues,
  mode: UserModuleMode,
): UpdateUserPayload {
  const isOperative = mode === "operative";
  const nextPassword = values.password.trim();
  const payload: UpdateUserPayload = {
    email: values.email.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim() || null,
    dateOfBirth: values.dateOfBirth.trim() || null,
    isActive: values.isActive,
    userTypeId: USER_TYPE_ID[mode],
    roleIds: isOperative ? null : [Number(values.roleId)],
    password: isOperative ? null : nextPassword || null,
  };

  if (isOperative) {
    payload.tradeId = Number(values.tradeId);
    payload.cisId = Number(values.cisId);
    payload.dailyRate = parseDailyRate(values.dailyRate);
  }

  return payload;
}
