import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authService } from "@/lib/api/services/auth";
import { notifyApiError } from "@/lib/api/axios";
import { AuthLayout } from "@/components/AuthLayout";
import { Form, PasswordField, SubmitButton } from "@/components/form";
import { newPasswordSchema, PasswordRequirements } from "@/lib/password";

const search = z.object({
  token: z.string().optional(),
  email: z.string().optional(),
});

const schema = z
  .object({
    password: newPasswordSchema,
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });
type Values = z.infer<typeof schema>;

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password | Schore" }] }),
  validateSearch: search,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const s = Route.useSearch();
  const token = s.token ?? "";
  const email = s.email ?? "";

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });
  const pw = form.watch("password");

  async function onSubmit(values: Values) {
    if (!token) {
      toast.error("Missing or invalid reset token. Request a new reset link.", {
        id: "api-error",
      });
      return;
    }
    try {
      const res = await authService.resetPassword({
        token,
        newPassword: values.password,
        confirmPassword: values.confirm,
      });
      toast.success(res.message || "Password updated");
      navigate({ to: "/signin" });
    } catch (err) {
      notifyApiError(err, "Failed to reset password");
    }
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={
        email ? (
          <>
            For <span className="font-medium text-foreground">{email}</span>
          </>
        ) : (
          "Enter and confirm your new password."
        )
      }
      footer={
        <p className="text-xs text-muted-foreground text-center">
          <Link to="/signin" className="text-foreground hover:underline">
            Back to Sign In
          </Link>
        </p>
      }
    >
      {!token && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Missing reset token. Please use the link from your reset email or request a new one.
          </span>
        </div>
      )}

      <Form form={form} onSubmit={onSubmit} className="space-y-4">
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

        <PasswordRequirements password={pw} />

        <SubmitButton className="w-full h-10" loadingText="Updating…" disabled={!token}>
          Update password
        </SubmitButton>
      </Form>
    </AuthLayout>
  );
}
