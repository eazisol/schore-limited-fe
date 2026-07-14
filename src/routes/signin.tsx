import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { HardHat, Mail, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { Form, TextField, PasswordField, CheckboxField, SubmitButton } from "@/components/form";

const signinSearchSchema = z.object({ redirect: z.string().optional() });

const signinSchema = z.object({
  emailOrUsername: z.string().trim().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});
type SignInValues = z.infer<typeof signinSchema>;

export const Route = createFileRoute("/signin")({
  head: () => ({ meta: [{ title: "Sign in — Schore Limited" }] }),
  validateSearch: signinSearchSchema,
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/signin" });
  const { signIn } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: { emailOrUsername: "admin@gmail.com", password: "", remember: true },
  });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    const result = await signIn(values.emailOrUsername.trim(), values.password);
    if (!result.ok) {
      setFormError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success(`Welcome back, ${result.user.firstName || result.user.username}`, {
      description: result.user.role ? `Signed in as ${result.user.role}` : undefined,
    });
    const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";
    navigate({ to: target });
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative bg-sidebar text-sidebar-foreground flex-col justify-between p-10 overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold">SCHORE</div>
            <div className="text-[11px] text-sidebar-foreground/60 tracking-wide">Workforce & Payroll</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-3xl font-semibold tracking-tight leading-tight">
            Digitised workforce, daily programme and weekly pay — in one place.
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/70">
            Replace your spreadsheets with a real-time view of every operative, property and payment.
          </p>
        </div>

        <div className="text-[11px] text-sidebar-foreground/50">
          © {new Date().getFullYear()} Schore Limited. All rights reserved.
        </div>

        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-info/15 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <HardHat className="h-5 w-5" />
            </div>
            <div className="font-display font-semibold">SCHORE</div>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in to your account</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your credentials to access the dashboard.
          </p>

          {formError && (
            <div role="alert" className="mt-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Form form={form} onSubmit={onSubmit} className="mt-6 space-y-4">
            <TextField<SignInValues>
              name="emailOrUsername"
              label="Email or username"
              required
              autoComplete="username"
              placeholder="you@schore.co.uk"
              leftIcon={Mail}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-end -mb-1">
                <Link
                  to="/forgot-password"
                  search={{ email: form.getValues("emailOrUsername") } as any}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordField<SignInValues>
                name="password"
                label="Password"
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                leftIcon={Lock}
              />
            </div>

            {/* Hidden per request — retained for future re-enable */}
            <div className="hidden">
              <CheckboxField<SignInValues>
                name="remember"
                label="Remember me for 30 days"
              />
            </div>


            <SubmitButton className="w-full h-10" loadingText="Signing in…">Sign in</SubmitButton>
          </Form>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Need access? <Link to="/" className="text-foreground hover:underline">Contact your administrator</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
