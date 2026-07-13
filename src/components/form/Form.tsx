import { FormProvider, type FieldValues, type UseFormReturn, type FieldErrors } from "react-hook-form";
import type { FormHTMLAttributes, ReactNode } from "react";
import { toast } from "sonner";

export interface FormProps<T extends FieldValues>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  form: UseFormReturn<T>;
  onSubmit: (values: T) => void | Promise<void>;
  /** Toast message shown when submit is attempted with invalid required fields. */
  invalidToastMessage?: string;
  /** Called with the RHF error map when validation fails. Optional. */
  onInvalid?: (errors: FieldErrors<T>) => void;
  children: ReactNode;
}

/**
 * Shared form wrapper.
 *
 * Validation UX rules (applied to every form in the app):
 *   - On invalid submit, show ONE toast (`invalidToastMessage`) instead of
 *     rendering per-field error messages.
 *   - Red border (via `aria-invalid`) is applied by each field component.
 *   - The first invalid field is focused and scrolled into view.
 *   - RHF default `reValidateMode: "onChange"` clears the invalid state as
 *     soon as the field becomes valid again.
 */
export function Form<T extends FieldValues>({
  form,
  onSubmit,
  invalidToastMessage = "Please fill all required fields.",
  onInvalid,
  children,
  ...rest
}: FormProps<T>) {
  const handleInvalid = (errors: FieldErrors<T>) => {
    toast.error(invalidToastMessage);
    focusFirstInvalid(errors, form);
    onInvalid?.(errors);
  };

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit, handleInvalid)} {...rest}>
        {children}
      </form>
    </FormProvider>
  );
}

function focusFirstInvalid<T extends FieldValues>(
  errors: FieldErrors<T>,
  form: UseFormReturn<T>,
) {
  const name = firstErrorPath(errors);
  if (!name) return;

  // Prefer RHF's setFocus — it handles registered inputs correctly.
  try {
    form.setFocus(name as any, { shouldSelect: true });
  } catch {
    /* not focusable via RHF (custom controls) — fall through to DOM lookup */
  }

  // Also scroll the element into view for custom controls.
  if (typeof document !== "undefined") {
    requestAnimationFrame(() => {
      const el =
        (document.querySelector(`[name="${cssEscape(name)}"]`) as HTMLElement | null) ??
        (document.querySelector(`[data-field="${cssEscape(name)}"]`) as HTMLElement | null);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el && document.activeElement !== el) {
        try { (el as HTMLElement).focus({ preventScroll: true }); } catch { /* ignore */ }
      }
    });
  }
}

function firstErrorPath(errors: any, prefix = ""): string | null {
  if (!errors || typeof errors !== "object") return null;
  for (const key of Object.keys(errors)) {
    const val = errors[key];
    if (!val) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (val.ref || val.type || val.message) return path;
    const nested = firstErrorPath(val, path);
    if (nested) return nested;
  }
  return null;
}

function cssEscape(v: string) {
  return v.replace(/["\\]/g, "\\$&");
}
