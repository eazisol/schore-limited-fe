import { z } from "zod";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { newPasswordSchema } from "@/lib/password";
import { emailSchema, userNameSchema } from "@/lib/user-validation";
import { ADDRESS_MAX_LENGTH } from "@/lib/field-validation";
import type { ApiUser, CreateUserPayload, UpdateUserPayload } from "@/lib/api/services/users";
import { toDateInputValue } from "@/lib/api/services/users";
import type { UserModuleMode } from "@/lib/user-module";
import { USER_TYPE_ID } from "@/lib/user-module";
import {
  rateOverrideRowSchema,
  rateOverridesToFormValues,
  refineRateOverrides,
  toRateOverridePayload,
  type RateOverrideFormValue,
} from "@/lib/rate-overrides";
import {
  certificationRowSchema,
  certificationsToFormValues,
  refineCertifications,
  toCertificationPayload,
  type CertificationFormValue,
} from "@/lib/operative-certifications";

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

/** Daily rate: optional; when set, ≥ 0 with up to 2 decimal places (operative). */
export const dailyRateSchema = z
  .string()
  .trim()
  .min(1, "Daily rate is required")
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter a valid amount (up to 2 decimal places)",
  })
  .transform((v) => Number(v))
  .refine((n) => n >= 0, { message: "Daily rate cannot be negative" });

const optionalDailyRateSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter a valid amount (up to 2 decimal places)",
  })
  .refine((v) => v === "" || Number(v) >= 0, { message: "Daily rate cannot be negative" });

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
  tradeIds: string[];
  cisId: string;
  dailyRate: string;
  isDailyRate: boolean;
  contactName: string;
  companyName: string;
  clientCode: string;
  address: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  contractorId: string;
  startDate: string;
  endDate: string;
  assignments: UserAssignmentFormValue[];
  capabilityOverrides: UserCapabilityOverrideFormValue[];
  menuPermissionOverrides: UserMenuPermissionOverrideFormValue[];
  rateOverrides: RateOverrideFormValue[];
  rateChangeReason: string;
  accountHolderName: string;
  sortCode: string;
  accountNumber: string;
  bankName: string;
  cardHolderName: string;
  cardNumber: string;
  cardExpiry: string;
  certifications: CertificationFormValue[];
};

export type UserAssignmentFormValue = {
  customerId: string;
  siteId: string;
  projectId: string;
  customerLabel: string;
  siteLabel: string;
  projectLabel: string;
};

export type UserCapabilityOverrideFormValue = {
  code: string;
  isGranted: boolean;
};

export type UserMenuPermissionOverrideFormValue = {
  menuId: string;
  read: boolean;
  modify: boolean;
  delete: boolean;
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
  tradeIds: [],
  cisId: "",
  dailyRate: "",
  isDailyRate: false,
  contactName: "",
  companyName: "",
  clientCode: "",
  address: "",
  zipCode: "",
  city: "",
  state: "",
  country: "",
  contractorId: "",
  startDate: "",
  endDate: "",
  assignments: [],
  capabilityOverrides: [],
  menuPermissionOverrides: [],
  rateOverrides: [],
  rateChangeReason: "",
  accountHolderName: "",
  sortCode: "",
  accountNumber: "",
  bankName: "",
  cardHolderName: "",
  cardNumber: "",
  cardExpiry: "",
  certifications: [],
};

export function userToFormValues(user: ApiUser): UserFormValues {
  return {
    ...emptyUserFormValues,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    dateOfBirth: toDateInputValue(user.dateOfBirth),
    roleId: user.roleIds?.[0] ?? "",
    isActive: user.isActive ?? true,
    password: "",
    tradeId: user.tradeId != null ? String(user.tradeId) : "",
    tradeIds: (() => {
      const ids = (user.tradeIds ?? []).map(String).filter(Boolean);
      if (ids.length > 0) return ids;
      return user.tradeId != null ? [String(user.tradeId)] : [];
    })(),
    cisId: user.cisId != null ? String(user.cisId) : "",
    dailyRate:
      user.dailyRate != null && !Number.isNaN(Number(user.dailyRate))
        ? String(user.dailyRate)
        : "",
    isDailyRate: user.isDailyRate ?? false,
    contactName: user.contactName ?? "",
    companyName: user.companyName ?? "",
    clientCode: user.clientCode ?? "",
    address: user.address ?? "",
    zipCode: user.zipCode ?? "",
    city: user.city ?? "",
    state: user.state ?? "",
    country: user.country ?? "",
    contractorId: user.contractorId != null ? String(user.contractorId) : "",
    startDate: toDateInputValue(user.startDate),
    endDate: toDateInputValue(user.endDate),
    assignments: (user.scopeAssignments ?? []).map((row) => ({
      customerId: row.customerId ? String(row.customerId) : "",
      siteId: row.siteId ? String(row.siteId) : "",
      projectId: row.projectId ? String(row.projectId) : "",
      customerLabel: row.customerName ?? "",
      siteLabel: row.siteName ?? "",
      projectLabel: row.projectName ?? "",
    })),
    capabilityOverrides: (user.capabilityOverrides ?? []).map((row) => ({
      code: row.code,
      isGranted: row.isGranted,
    })),
    menuPermissionOverrides: (user.menuPermissionOverrides ?? []).map((row) => ({
      menuId: row.menuId,
      read: row.read,
      modify: row.modify,
      delete: row.delete,
    })),
    rateOverrides: rateOverridesToFormValues(user.rateOverrides),
    rateChangeReason: "",
    accountHolderName: user.accountHolderName ?? "",
    sortCode: formatSortCodeInput(user.sortCode ?? ""),
    accountNumber: formatAccountNumberInput(user.accountNumber ?? ""),
    bankName: user.bankName ?? "",
    cardHolderName: user.cardHolderName ?? "",
    cardNumber: user.cardNumber ?? "",
    cardExpiry: user.cardExpiry ?? "",
    certifications: certificationsToFormValues(user.certifications),
  };
}

function operativeExtrasRefine(values: UserFormValues, ctx: z.RefinementCtx) {
  if (!values.cisId.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["cisId"],
      message: "CIS is required for operatives.",
    });
  }

  const rate = values.dailyRate.trim();
  if (!rate) return;
  const parsed = optionalDailyRateSchema.safeParse(rate);
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

  if (mode === "customer") {
    const clientCode = values.clientCode.trim();
    if (clientCode && clientCode.length > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["clientCode"],
        message: "Code must be 100 characters or fewer",
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
  const parsedStart = startDate ? parseDateInput(startDate) : null;

  if (startDate && !parsedStart) {
    ctx.addIssue({
      code: "custom",
      path: ["startDate"],
      message: "Enter a valid start date.",
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
  tradeIds: z.array(z.string()),
  cisId: z.string(),
  dailyRate: z.string(),
  isDailyRate: z.boolean(),
  contactName: z.string(),
  companyName: z.string(),
  clientCode: z.string(),
  address: z.string(),
  zipCode: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  contractorId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  assignments: z.array(
    z.object({
      customerId: z.string(),
      siteId: z.string(),
      projectId: z.string(),
      customerLabel: z.string(),
      siteLabel: z.string(),
      projectLabel: z.string(),
    }),
  ),
  capabilityOverrides: z.array(
    z.object({
      code: z.string(),
      isGranted: z.boolean(),
    }),
  ),
  menuPermissionOverrides: z.array(
    z.object({
      menuId: z.string(),
      read: z.boolean(),
      modify: z.boolean(),
      delete: z.boolean(),
    }),
  ),
  rateOverrides: z.array(rateOverrideRowSchema),
  rateChangeReason: z.string(),
  accountHolderName: z.string(),
  sortCode: z.string(),
  accountNumber: z.string(),
  bankName: z.string(),
  cardHolderName: z.string(),
  cardNumber: z.string(),
  cardExpiry: z.string(),
  certifications: z.array(certificationRowSchema),
};

function applyModeRefinements<T extends z.ZodTypeAny>(mode: UserModuleMode, schema: T) {
  if (mode === "operative") {
    return schema.superRefine((values: UserFormValues, ctx) => {
      operativeExtrasRefine(values, ctx);
      employmentDatesRefine(values, ctx);
      refineRateOverrides(values.rateOverrides, ctx);
      refineCertifications(values.certifications, ctx);
      refineBankDetails(values, ctx);
      refineCardDetails(values, ctx);
    });
  }

  if (mode === "contractor" || mode === "customer") {
    return schema.superRefine((values: UserFormValues, ctx) => {
      contactModuleExtrasRefine(mode, values, ctx);
      if (mode === "customer") {
        refineRateOverrides(values.rateOverrides, ctx);
      }
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

function refineBankDetails(values: UserFormValues, ctx: z.RefinementCtx) {
  const holder = values.accountHolderName.trim();
  const sort = values.sortCode.trim();
  const account = values.accountNumber.replace(/\s+/g, "").trim();
  const bank = values.bankName.trim();
  const anyFilled = Boolean(holder || sort || account || bank);
  if (!anyFilled) return;

  if (holder.length > 120) {
    ctx.addIssue({
      code: "custom",
      path: ["accountHolderName"],
      message: "Account holder name must be 120 characters or fewer",
    });
  }

  const sortDigits = sort.replace(/\D/g, "");
  if (!sortDigits) {
    ctx.addIssue({
      code: "custom",
      path: ["sortCode"],
      message: "Sort code is required",
    });
  } else if (!/^\d{6}$/.test(sortDigits)) {
    ctx.addIssue({
      code: "custom",
      path: ["sortCode"],
      message: "Enter a valid UK sort code (e.g. 12-34-56)",
    });
  }

  if (!account) {
    ctx.addIssue({
      code: "custom",
      path: ["accountNumber"],
      message: "Account number is required",
    });
  } else if (!/^\d{8}$/.test(account)) {
    ctx.addIssue({
      code: "custom",
      path: ["accountNumber"],
      message: "Enter a valid 8-digit account number",
    });
  }

  if (bank.length > 100) {
    ctx.addIssue({
      code: "custom",
      path: ["bankName"],
      message: "Bank name must be 100 characters or fewer",
    });
  }
}

/** Format UK sort code as XX-XX-XX while typing. */
export function formatSortCodeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 6));
  return parts.join("-");
}

/** Digits-only account number, max 8 (UK). */
export function formatAccountNumberInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

function refineCardDetails(values: UserFormValues, ctx: z.RefinementCtx) {
  const holder = values.cardHolderName.trim();
  const number = values.cardNumber.replace(/\s+/g, "");
  const expiry = values.cardExpiry.trim();
  const anyFilled = Boolean(holder || number || expiry);
  if (!anyFilled) return;

  if (holder.length > 120) {
    ctx.addIssue({
      code: "custom",
      path: ["cardHolderName"],
      message: "Cardholder name must be 120 characters or fewer",
    });
  }
  if (number && !/^\d{13,19}$/.test(number)) {
    ctx.addIssue({
      code: "custom",
      path: ["cardNumber"],
      message: "Enter a valid card number (13–19 digits)",
    });
  }
  if (expiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    ctx.addIssue({
      code: "custom",
      path: ["cardExpiry"],
      message: "Enter expiry as MM/YY",
    });
  }
}

function parseDailyRate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = dailyRateSchema.safeParse(trimmed);
  return parsed.success ? parsed.data : null;
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
  if (isCustomer) {
    payload.clientCode = values.clientCode.trim() || null;
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
    roleIds: isUser ? [values.roleId] : null,
    startDate: isOperative ? values.startDate.trim() || null : null,
    endDate: null,
  };

  if (isOperative) {
    const tradeIds = values.tradeIds.map((id) => id.trim()).filter((id) => id.length > 0);
    payload.tradeIds = tradeIds;
    payload.tradeId = tradeIds[0] ?? null;
    payload.cisId = values.cisId.trim() || null;
    payload.dailyRate = parseDailyRate(values.dailyRate);
    payload.isDailyRate = values.isDailyRate;
    payload.accountHolderName = values.accountHolderName.trim() || null;
    payload.sortCode = (() => {
      const digits = values.sortCode.replace(/\D/g, "");
      if (digits.length !== 6) return values.sortCode.trim() || null;
      return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
    })();
    payload.accountNumber = values.accountNumber.replace(/\D/g, "").trim() || null;
    payload.bankName = values.bankName.trim() || null;
    payload.cardHolderName = values.cardHolderName.trim() || null;
    payload.cardNumber = values.cardNumber.replace(/\s+/g, "").trim() || null;
    payload.cardExpiry = values.cardExpiry.trim() || null;
    payload.certifications = toCertificationPayload(values.certifications);
  }

  if (isContactModule) {
    applyContactPayload(payload, values, mode);
  }

  if (isUser) {
    payload.capabilities = values.capabilityOverrides.map((row) => ({
      code: row.code,
      isGranted: row.isGranted,
    }));
    payload.menuPermissions = values.menuPermissionOverrides.map((row) => ({
      menuId: row.menuId,
      read: row.read,
      modify: row.modify,
      delete: row.delete,
    }));
  }

  if (isCustomer || isOperative) {
    payload.rateOverrides = toRateOverridePayload(values.rateOverrides);
    payload.rateChangeReason = values.rateChangeReason.trim() || null;
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
    roleIds: isUser ? [values.roleId] : null,
    password: isUser ? nextPassword || null : isOperative ? nextPassword || null : null,
    startDate: isOperative ? values.startDate.trim() || null : null,
    endDate: null,
  };

  if (isOperative) {
    const tradeIds = values.tradeIds.map((id) => id.trim()).filter((id) => id.length > 0);
    payload.tradeIds = tradeIds;
    payload.tradeId = tradeIds[0] ?? null;
    payload.cisId = values.cisId.trim() || null;
    payload.dailyRate = parseDailyRate(values.dailyRate);
    payload.isDailyRate = values.isDailyRate;
    payload.accountHolderName = values.accountHolderName.trim() || null;
    payload.sortCode = (() => {
      const digits = values.sortCode.replace(/\D/g, "");
      if (digits.length !== 6) return values.sortCode.trim() || null;
      return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
    })();
    payload.accountNumber = values.accountNumber.replace(/\D/g, "").trim() || null;
    payload.bankName = values.bankName.trim() || null;
    payload.cardHolderName = values.cardHolderName.trim() || null;
    payload.cardNumber = values.cardNumber.replace(/\s+/g, "").trim() || null;
    payload.cardExpiry = values.cardExpiry.trim() || null;
    payload.certifications = toCertificationPayload(values.certifications);
  }

  if (isContactModule) {
    applyContactPayload(payload, values, mode);
  }

  if (isUser) {
    payload.capabilities = values.capabilityOverrides.map((row) => ({
      code: row.code,
      isGranted: row.isGranted,
    }));
    payload.menuPermissions = values.menuPermissionOverrides.map((row) => ({
      menuId: row.menuId,
      read: row.read,
      modify: row.modify,
      delete: row.delete,
    }));
  }

  if (isCustomer || isOperative) {
    payload.rateOverrides = toRateOverridePayload(values.rateOverrides);
    payload.rateChangeReason = values.rateChangeReason.trim() || null;
  }

  return payload;
}
