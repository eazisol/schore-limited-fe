import type { FieldError } from "react-hook-form";

/** Red border / aria-invalid only after a submit attempt (not on initial load). */
export function shouldShowFieldError(
  error: FieldError | undefined,
  isSubmitted: boolean,
): boolean {
  return !!error && isSubmitted;
}
