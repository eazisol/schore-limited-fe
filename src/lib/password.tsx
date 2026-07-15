import { z } from "zod";
import { cn } from "@/lib/utils";

export const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p: string) => p.length >= 8,
  },
  {
    id: "upper",
    label: "At least 1 uppercase letter",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    id: "lower",
    label: "At least 1 lowercase letter",
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    id: "number",
    label: "At least 1 number",
    test: (p: string) => /[0-9]/.test(p),
  },
  {
    id: "special",
    label: "At least 1 special character",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
] as const;

/** Zod schema for a new password (change / reset flows). */
export const newPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .min(8, "Must be at least 8 characters")
  .regex(/[A-Z]/, "Include at least 1 uppercase letter")
  .regex(/[a-z]/, "Include at least 1 lowercase letter")
  .regex(/[0-9]/, "Include at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Include at least 1 special character");

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-4 py-3">
      <div className="text-xs font-medium text-foreground mb-1.5">Password must include:</div>
      <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
        {PASSWORD_REQUIREMENTS.map((req) => (
          <li key={req.id} className={cn(req.test(password) && "text-info")}>
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
