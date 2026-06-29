import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { HardHat, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersStore } from "@/lib/users-store";
import { cn } from "@/lib/utils";

const search = z.object({ email: z.string().optional() });

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — Schore" }] }),
  validateSearch: search,
  component: ForgotPassword,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPassword() {
  const navigate = useNavigate();
  const s = Route.useSearch();
  const [email, setEmail] = useState(s.email ?? "");
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(undefined);
    if (!email.trim()) return setError("Email is required");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address");

    setSubmitting(true);
    await new Promise(r => setTimeout(r, 500));
    const exists = !!usersStore.byEmail(email);
    setSubmitting(false);
    // Always show success to avoid leaking which emails exist
    setSent(true);
    if (exists) {
      // In a real backend this would email a token; here we just navigate after a moment.
      setTimeout(() => navigate({ to: "/reset-password", search: { email: email.trim() } as any }), 1200);
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
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
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
            <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email" type="email" autoComplete="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(undefined); }}
                    placeholder="you@schore.co.uk"
                    className={cn("pl-9", error && "border-destructive focus-visible:ring-destructive")}
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-10">
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <Link to="/signin" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
