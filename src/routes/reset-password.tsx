import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { HardHat, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersStore } from "@/lib/users-store";
import { authStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const search = z.object({ email: z.string().optional() });

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

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<{ pw?: string; pw2?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const e: typeof err = {};
    if (!pw) e.pw = "Password is required";
    else if (pw.length < 8) e.pw = "Must be at least 8 characters";
    else if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) e.pw = "Include at least one uppercase letter and one number";
    if (pw !== pw2) e.pw2 = "Passwords do not match";
    if (!user) e.form = "We couldn't find that account. Request a new reset link.";
    setErr(e);
    if (Object.keys(e).length) return;

    setSubmitting(true);
    await authStore.setPassword(user!.id, pw);
    setSubmitting(false);
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

        {err.form && (
          <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {err.form}
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          {(["pw", "pw2"] as const).map(field => (
            <div className="space-y-1.5" key={field}>
              <Label htmlFor={field}>{field === "pw" ? "New password" : "Confirm password"}</Label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={field} type={show ? "text" : "password"} autoComplete="new-password"
                  value={field === "pw" ? pw : pw2}
                  onChange={e => {
                    if (field === "pw") { setPw(e.target.value); setErr({ ...err, pw: undefined }); }
                    else { setPw2(e.target.value); setErr({ ...err, pw2: undefined }); }
                  }}
                  className={cn("pl-9 pr-10", err[field] && "border-destructive focus-visible:ring-destructive")}
                />
                {field === "pw" && (
                  <button type="button" onClick={() => setShow(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10"
                    aria-label={show ? "Hide passwords" : "Show passwords"}>
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {err[field] && <p className="text-xs text-destructive">{err[field]}</p>}
            </div>
          ))}

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

          <Button type="submit" disabled={submitting} className="w-full h-10">
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          <Link to="/signin" className="text-foreground hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
