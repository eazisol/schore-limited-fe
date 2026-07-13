import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HardHat, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usersStore } from "@/lib/users-store";
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
  const navigate = useNavigate();
  const s = Route.useSearch();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: s.email ?? "" },
    mode: "onBlur",
  });

  async function onSubmit(values: Values) {
    await new Promise(r => setTimeout(r, 400));
    const exists = !!usersStore.byEmail(values.email);
    setSentEmail(values.email);
    setSent(true);
    if (exists) {
      setTimeout(() => navigate({ to: "/reset-password", search: { email: values.email } as any }), 1200);
    }
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

        {sent ? (
          <div className="rounded-md border border-border bg-card p-6 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-info" />
            <h1 className="mt-3 font-display text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{sentEmail}</span>,
              we've sent a link to reset your password.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Demo: redirecting you to the reset screen…
            </p>
            <Link to="/signin" className="mt-6 inline-flex items-center gap-1.5 text-sm text-foreground hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter the email address on your account and we'll send you a link to set a new password.
            </p>
            <Form form={form} onSubmit={onSubmit} className="mt-6 space-y-4">
              <TextField<Values>
                name="email"
                label="Email"
                required
                type="email"
                autoComplete="email"
                placeholder="you@schore.co.uk"
                leftIcon={Mail}
              />
              <SubmitButton className="w-full h-10" loadingText="Sending…">Send reset link</SubmitButton>
            </Form>
            <Link to="/signin" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
