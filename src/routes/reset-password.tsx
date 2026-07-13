import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HardHat, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usersStore } from "@/lib/users-store";
import { authStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { Form, PasswordField, SubmitButton } from "@/components/form";

const search = z.object({ email: z.string().optional() });

const schema = z.object({
  password: z.string()
    .min(8, "Must be at least 8 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[0-9]/, "Include at least one number"),
  confirm: z.string().min(1, "Please confirm your password"),
}).refine(v => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type Values = z.infer<typeof schema>;

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Schore" }] }),
  validateSearch: search,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const s = Route.useSearch();
  const email = s.email ?? "";
  const user = email ? usersStore.byEmail(email) : null;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
    mode: "onBlur",
  });
  const pw = form.watch("password");

  async function onSubmit(values: Values) {
    if (!user) {
      form.setError("password", { message: "We couldn't find that account. Request a new reset link." });
      return;
    }
    await authStore.setPassword(user.id, values.password);
    toast.success("Password updated", { description: "You can now sign in with your new password." });
    navigate({ to: "/signin" });
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="font-display font-semibold">SCHORE</div>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {email ? <>For <span className="font-medium text-foreground">{email}</span></> : "Enter and confirm your new password."}
        </p>

        <Form form={form} onSubmit={onSubmit} className="mt-6 space-y-4">
          <PasswordField<Values>
            name="password"
            label="New password"
            required
            autoComplete="new-password"
            leftIcon={Lock}
          />
          <PasswordField<Values>
            name="confirm"
            label="Confirm password"
            required
            autoComplete="new-password"
            leftIcon={Lock}
            showToggle={false}
          />

          <ul className="text-xs text-muted-foreground space-y-1">
            <li className={cn("flex items-center gap-1.5", pw.length >= 8 && "text-info")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> At least 8 characters
            </li>
            <li className={cn("flex items-center gap-1.5", /[A-Z]/.test(pw) && "text-info")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> One uppercase letter
            </li>
            <li className={cn("flex items-center gap-1.5", /[0-9]/.test(pw) && "text-info")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> One number
            </li>
          </ul>

          <SubmitButton className="w-full h-10" loadingText="Updating…">Update password</SubmitButton>
        </Form>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          <Link to="/signin" className="text-foreground hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
