import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authService } from "@/lib/api/services/auth";
import { notifyApiError } from "@/lib/api/axios";
import { AuthLayout } from "@/components/AuthLayout";
import { Form, TextField, SubmitButton } from "@/components/form";

const search = z.object({ email: z.string().optional() });

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});
type Values = z.infer<typeof schema>;

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — Schore" }] }),
  validateSearch: search,
  component: ForgotPassword,
});

function ForgotPassword() {
  const s = Route.useSearch();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: (s.email ?? "").trim() },
  });

  async function onSubmit(values: Values) {
    const email = values.email.trim();
    try {
      const res = await authService.forgotPassword({ email });
      setSentEmail(email);
      setSent(true);
      toast.success(res.message || "Reset link sent");
    } catch (err) {
      notifyApiError(err, "Failed to send reset link");
    }
  }

  const backLink = (
    <p className="text-center">
      <Link
        to="/signin"
        className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
      </Link>
    </p>
  );

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={
          <>
            If an account exists for{" "}
            <span className="font-medium text-foreground">{sentEmail}</span>, we&apos;ve sent a link
            to reset your password.
          </>
        }
        footer={backLink}
      >
        <div className="flex justify-center py-2">
          <CheckCircle2 className="h-10 w-10 text-info" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email address on your account and we'll send you a link to set a new password."
      footer={backLink}
    >
      <Form form={form} onSubmit={onSubmit} className="space-y-4">
        <TextField<Values>
          name="email"
          label="Email"
          required
          type="email"
          autoComplete="email"
          placeholder="you@schore.co.uk"
          leftIcon={Mail}
        />
        <SubmitButton className="w-full h-10" loadingText="Sending…">
          Send reset link
        </SubmitButton>
      </Form>
    </AuthLayout>
  );
}
