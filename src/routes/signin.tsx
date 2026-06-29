import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, HardHat, Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { authStore } from "@/lib/auth-store";


export const Route = createFileRoute("/signin")({
  head: () => ({ meta: [{ title: "Sign in — Schore Limited" }] }),
  component: SignIn,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("daniel@schore.co.uk");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Password must be at least 6 characters";
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setSubmitting(true);
    await new Promise(r => setTimeout(r, 700));

    const user = usersStore.getAll().find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      setSubmitting(false);
      setErrors({ form: "No account found with that email. Please contact your administrator." });
      return;
    }
    if (user.status === "Inactive") {
      setSubmitting(false);
      setErrors({ form: "This account has been deactivated. Please contact your administrator." });
      return;
    }

    sessionStore.setRole(user.role as UserRole);
    toast.success(`Welcome back, ${user.name.split(" ")[0]}`, { description: `Signed in as ${user.role}` });
    setSubmitting(false);
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Left – brand panel */}
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
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Daily programme & work confirmation",
              "Automated price-work payroll with CIS",
              "KPI clock, hold management & cost vs budget",
            ].map(t => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-sidebar-foreground/85">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-[11px] text-sidebar-foreground/50">
          © {new Date().getFullYear()} Schore Limited. All rights reserved.
        </div>

        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-info/15 blur-3xl" />
      </div>

      {/* Right – form */}
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

          {errors.form && (
            <div role="alert" className="mt-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@schore.co.uk"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                  aria-invalid={!!errors.email}
                  className={cn("pl-9", errors.email && "border-destructive focus-visible:ring-destructive")}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => toast("Password reset", { description: `If an account exists for ${email || "that email"}, a reset link will be sent.` })}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                  aria-invalid={!!errors.password}
                  className={cn("pl-9 pr-10", errors.password && "border-destructive focus-visible:ring-destructive")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  aria-pressed={showPw}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <label className="flex items-center gap-2 select-none cursor-pointer">
              <Checkbox
                checked={remember}
                onCheckedChange={v => setRemember(v === true)}
                id="remember"
              />
              <span className="text-sm text-foreground/80">Remember me for 30 days</span>
            </label>

            <Button type="submit" disabled={submitting} className="w-full h-10">
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>) : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Demo accounts</div>
            <ul className="space-y-0.5">
              <li><span className="font-mono">daniel@schore.co.uk</span> — Admin</li>
              <li><span className="font-mono">marcus@schore.co.uk</span> — Manager</li>
              <li><span className="font-mono">claudiu@schore.co.uk</span> — User</li>
            </ul>
            <p className="mt-2">Use any password (min. 6 characters).</p>
          </div>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Need access? <Link to="/" className="text-foreground hover:underline">Contact your administrator</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
