import { z } from "zod";

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function userNameSchema(label: "First name" | "Last name") {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be 50 characters or fewer`)
    .regex(NAME_PATTERN, `${label} contains invalid characters`);
}

export function emailSchema(label = "Email") {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(EMAIL_FORMAT_PATTERN, "Enter a valid email address");
}
