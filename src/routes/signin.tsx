import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/AuthLayout";
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

  const form = useForm<SignInValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: { emailOrUsername: "", password: "", remember: true },
  });

  async function onSubmit(values: SignInValues) {
    const result = await signIn(values.emailOrUsername.trim(), values.password);
    if (!result.ok) {
      if (!result.toasted) {
        toast.error(result.message || "Unable to sign in. Please try again.", {
          id: "api-error",
        });
      }
      return;
    }
    toast.success(`Welcome back, ${result.user.firstName || result.user.username}`, {
      description: result.user.role ? `Signed in as ${result.user.role}` : undefined,
    });
    const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";
    navigate({ to: target });
  }

  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Enter your credentials to access the dashboard."
      // footer={
      //   <p className="text-xs text-muted-foreground text-center">
      //     Need access?{" "}
      //     <Link to="/" className="text-foreground hover:underline">
      //       Contact your administrator
      //     </Link>
      //     .
      //   </p>
      // }
    >
      <Form form={form} onSubmit={onSubmit} className="space-y-4">
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

        <div className="hidden">
          <CheckboxField<SignInValues> name="remember" label="Remember me for 30 days" />
        </div>

        <SubmitButton className="w-full h-10" loadingText="Signing in…">
          Sign in
        </SubmitButton>
      </Form>
    </AuthLayout>
  );
}
