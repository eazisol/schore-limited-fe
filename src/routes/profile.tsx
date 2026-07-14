import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Save, Loader2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { usersStore } from "@/lib/users-store";
import { Form, TextField, PasswordField, AvatarUploadField, SubmitButton } from "@/components/form";
import { authService } from "@/lib/api/services/auth";
import { usersService, type ApiUser } from "@/lib/api/services/users";
import type { ApiError } from "@/lib/api/axios";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My profile — Schore" }] }),
  component: ProfilePage,
});

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80, "Must be under 80 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(80, "Must be under 80 characters"),
  phone: z.string().trim().max(20).regex(/^[\d +()-]{7,20}$/, "Enter a valid phone number").or(z.literal("")),
  avatar: z.string().or(z.literal("")),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  password: z.string()
    .min(8, "Must be at least 8 characters")
    .regex(/[A-Z]/, "Include one uppercase letter")
    .regex(/[0-9]/, "Include one number"),
  confirm: z.string(),
}).refine(v => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type PasswordValues = z.infer<typeof passwordSchema>;

function ProfilePage() {
  const { user: authUser } = useAuth();
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const localExtras = authUser ? usersStore.get(String(authUser.id)) : null;

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: authUser?.firstName ?? "",
      lastName: authUser?.lastName ?? "",
      phone: localExtras?.phone ?? "",
      avatar: localExtras?.avatar ?? "",
    },
  });

  const pwForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", password: "", confirm: "" },
  });

  // Load full API user (for userTypeId + roleIds required by PUT payload).
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await usersService.get(authUser.id);
        if (cancelled) return;
        setApiUser(res.data);
        profileForm.reset({
          firstName: res.data.firstName ?? "",
          lastName: res.data.lastName ?? "",
          phone: localExtras?.phone ?? "",
          avatar: localExtras?.avatar ?? "",
        });
      } catch {
        /* interceptor toasts */
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  const initials = useMemo(() => {
    const name = `${authUser?.firstName ?? ""} ${authUser?.lastName ?? ""}`.trim() || authUser?.username || "";
    return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  }, [authUser]);

  if (!authUser) return null;

  const jobTitle = apiUser?.userTypeName ?? "";
  const roleName = apiUser?.roleNames?.[0] ?? authUser.role ?? "—";

  async function onSaveProfile(values: ProfileValues) {
    if (!apiUser) return;
    try {
      await usersService.update(apiUser.id, {
        email: apiUser.email,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        isActive: apiUser.isActive,
        userTypeId: apiUser.userTypeId,
        roleIds: apiUser.roleIds ?? [],
      });
      // Persist local-only extras (phone/avatar) so they survive reloads.
      usersStore.update(String(apiUser.id), {
        phone: values.phone.trim() || undefined,
        avatar: values.avatar || undefined,
      });
      toast.success("Profile updated");
    } catch (err) {
      const e = err as ApiError;
      toast.error(e?.message || "Failed to update profile");
    }
  }

  async function onChangePassword(values: PasswordValues) {
    try {
      const res = await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.password,
        confirmPassword: values.confirm,
      });
      pwForm.reset({ currentPassword: "", password: "", confirm: "" });
      toast.success(res.message || "Password changed");
    } catch (err) {
      const e = err as ApiError;
      toast.error(e?.message || "Failed to change password");
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="My profile" subtitle="Your personal details, avatar and password." />

      <Form form={profileForm} onSubmit={onSaveProfile} className="card-elevated p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <AvatarUploadField<ProfileValues> name="avatar" initials={initials} />
            <div className="min-w-0">
              <div className="font-display font-semibold text-lg truncate">
                {`${authUser.firstName} ${authUser.lastName}`.trim() || authUser.username}
              </div>
              <div className="text-xs text-muted-foreground">{authUser.email}</div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <TextField<ProfileValues> name="firstName" label="First name" required maxLength={80} />
          <TextField<ProfileValues> name="lastName" label="Last name" required maxLength={80} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input value={authUser.email} disabled className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Job title</label>
            <input value={jobTitle} disabled className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Job title is managed by an administrator.</p>
          </div>
          <TextField<ProfileValues> name="phone" label="Phone" placeholder="07700 900000" />
        </div>

        <div className="flex justify-end">
          <SubmitButton loadingText="Saving…" disabled={loadingUser || !apiUser}>
            {loadingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </SubmitButton>
        </div>
      </Form>

      <Form form={pwForm} onSubmit={onChangePassword} className="card-elevated p-6 mt-6 space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold">Change password</h2>
        </div>
        <PasswordField<PasswordValues> name="currentPassword" label="Current password" required autoComplete="current-password" />
        <div className="grid sm:grid-cols-2 gap-4">
          <PasswordField<PasswordValues> name="password" label="New password" required autoComplete="new-password" />
          <PasswordField<PasswordValues> name="confirm" label="Confirm new password" required autoComplete="new-password" showToggle={false} />
        </div>
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <div className="text-xs font-medium text-foreground mb-1.5">Password must include:</div>
          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
            <li>At least one uppercase letter</li>
            <li>At least one lowercase letter</li>
            <li>At least one number</li>
            <li>At least one special character</li>
            <li>Minimum 8 characters</li>
          </ul>
        </div>
        <div className="flex justify-end pt-2 border-t">
          <SubmitButton variant="outline" loadingText="Updating…">Update password</SubmitButton>
        </div>
      </Form>
    </div>
  );
}
