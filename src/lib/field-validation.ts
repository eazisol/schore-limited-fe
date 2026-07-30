import { z } from "zod";

/** Standard max length for entity Name fields across modules. */
export const NAME_MAX_LENGTH = 100;

/** Standard max length for Code fields across modules. */
export const CODE_MAX_LENGTH = 50;

/** Standard max length for Description fields across modules. */
export const DESCRIPTION_MAX_LENGTH = 500;

/** Standard max length for Address fields across modules. */
export const ADDRESS_MAX_LENGTH = 50;

/** Letters, digits, underscore, hyphen, and spaces — Code fields (validated after uppercase). */
const CODE_PATTERN = /^[A-Z0-9_ -]+$/;

/**
 * Shared Name field schema — use for every entity Name field.
 * Required, trimmed, 2–100 chars, no consecutive spaces.
 */
export function nameSchema(label = "Name", maxLength = NAME_MAX_LENGTH) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer`)
    .refine((v) => v.length >= 2, {
      message: `${label} must be at least 2 characters`,
    })
    .refine((v) => !/\s{2,}/.test(v), {
      message: `${label} cannot contain consecutive spaces`,
    });
}

/**
 * Shared Code field schema — required, max 50, A-Z / 0-9 / _ / - / spaces.
 * Pair with `normalizeCodeInput` on the field so values stay uppercase in the UI.
 */
export function codeSchema(label = "Code", maxLength = CODE_MAX_LENGTH) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer`)
    .refine(
      (v) => CODE_PATTERN.test(v.toUpperCase()),
      `${label} can only contain letters, numbers, spaces, underscores and hyphens`,
    );
}

/**
 * Shared Description field schema (optional text, max length enforced).
 */
export function descriptionSchema(maxLength = DESCRIPTION_MAX_LENGTH) {
  return z
    .string()
    .trim()
    .max(maxLength, `Description must be ${maxLength} characters or fewer`);
}

/**
 * Shared Order By schema — required whole number ≥ 0.
 */
export function orderBySchema(label = "Order") {
  return z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} must be 0 or greater`);
}

/**
 * Shared Rate schema (CIS) — required number ≥ 0, max 2 decimal places.
 */
export function rateSchema(label = "Rate") {
  return z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} must be 0 or greater`)
    .refine((value) => Number.isFinite(value), `${label} must be a valid number`)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
      `${label} can have at most 2 decimal places`,
    );
}

/** Normalize code input while typing (uppercase; spaces are allowed). */
export function normalizeCodeInput(value: string): string {
  return value.toUpperCase();
}
