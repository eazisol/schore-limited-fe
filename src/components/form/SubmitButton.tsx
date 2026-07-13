import { useFormContext } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { ComponentProps, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";

export interface SubmitButtonProps
  extends Omit<ComponentProps<"button">, "type">,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

/** Submit button integrated with react-hook-form's `formState.isSubmitting`. */
export function SubmitButton({
  loading, loadingText, children, disabled, ...rest
}: SubmitButtonProps) {
  const ctx = useFormContextSafe();
  const isSubmitting = loading ?? ctx?.formState.isSubmitting ?? false;
  return (
    <Button type="submit" disabled={disabled || isSubmitting} {...rest}>
      {isSubmitting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText ?? "Please wait…"}
        </>
      ) : children}
    </Button>
  );
}

function useFormContextSafe() {
  try { return useFormContext(); } catch { return null; }
}
