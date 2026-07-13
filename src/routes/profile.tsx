import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Save } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { authStore, useAuthSession } from "@/lib/auth-store";
import { usersStore, ROLE_LABEL, ROLE_BADGE } from "@/lib/users-store";
import { cn } from "@/lib/utils";
import { Form, TextField, PasswordField, AvatarUploadField, SubmitButton } from "@/components/form";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My profile — Schore" }] }),
  component: ProfilePage,
});

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name must be under 80 characters"),
  phone: z.string().trim().max(20).regex(/^[\d +()-]{7,20}$/, "Enter a valid phone number").or(z.literal("")),
  jobTitle: z.string().trim().max(60).or(z.literal("")),
  avatar: z.string().or(z.literal("")),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  password: z.string()
    .min(8, "Must be at least 8 characters")
    .regex(/[A-Z]/, "Include one uppercase letter")
    .regex(/[0-9]/, "Include one number"),
  confirm: z.string(),
}).refine(v => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type PasswordValues = z.infer<typeof passwordSchema>;

function ProfilePage() {
  useAuthSession();
  const user = authStore.getUser();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      jobTitle: user?.jobTitle ?? "",
      avatar: user?.avatar ?? "",
    },
  });

  const pwForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  if (!user) return null;
  const initials = user.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  async function onSaveProfile(values: ProfileValues) {
    usersStore.update(user!.id, {
      name: values.name.trim(),
      phone: values.phone.trim() || undefined,
      jobTitle: values.jobTitle.trim() || undefined,
      avatar: values.avatar || undefined,
    });
    toast.success("Profile updated");
  }

  async function onChangePassword(values: PasswordValues) {
    await authStore.setPassword(user!.id, values.password);
    pwForm.reset({ password: "", confirm: "" });
    toast.success("Password changed");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="My profile" subtitle="Your personal details, avatar and password." />

      <Form form={profileForm} onSubmit={onSaveProfile} className="card-elevated p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <AvatarUploadField<ProfileValues> name="avatar" initials={initials} />
            <div className="min-w-0">
              <div className="font-display font-semibold text-lg truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
              <span className={cn("mt-1.5 inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border", ROLE_BADGE[user.role])}>
                {ROLE_LABEL[user.role]}
              </span>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <TextField<ProfileValues> name="name" label="Full name" required maxLength={80} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input value={user.email} disabled className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
          <TextField<ProfileValues> name="phone" label="Phone" placeholder="07700 900000" />
          <TextField<ProfileValues> name="jobTitle" label="Job title" maxLength={60} />
        </div>

        <div className="flex justify-end">
          <SubmitButton loadingText="Saving…"><Save className="h-4 w-4" /> Save changes</SubmitButton>
        </div>
      </Form>

      <Form form={pwForm} onSubmit={onChangePassword} className="card-elevated p-6 mt-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold">Change password</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <PasswordField<PasswordValues> name="password" label="New password" required autoComplete="new-password" />
          <PasswordField<PasswordValues> name="confirm" label="Confirm" required autoComplete="new-password" showToggle={false} />
        </div>
        <div className="flex justify-end">
          <SubmitButton variant="outline" loadingText="Updating…">Update password</SubmitButton>
        </div>
      </Form>
    </div>
  );
}
