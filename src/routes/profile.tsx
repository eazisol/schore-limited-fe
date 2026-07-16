import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Save, Loader2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import {
  Form,
  TextField,
  PasswordField,
  AvatarUploadField,
  SubmitButton,
  PhoneNumberField,
} from "@/components/form";
import { authService } from "@/lib/api/services/auth";
import {
  resolveProfileImageUrl,
  toDateInputValue,
  usersService,
  type ApiUser,
} from "@/lib/api/services/users";
import { notifyApiError } from "@/lib/api/axios";
import { newPasswordSchema, PasswordRequirements } from "@/lib/password";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My profile — Schore" }] }),
  component: ProfilePage,
});

function parseDobInput(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function validatePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

const profileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(80, "Must be under 80 characters"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(80, "Must be under 80 characters"),
  phone: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) return;
      if (!validatePhoneNumber(v)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number (10-15 digits)." });
      }
    }),
  dateOfBirth: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) return;
      const d = parseDobInput(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date of birth." });
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d.getTime() > today.getTime()) {
        ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future." });
      }
    }),
  avatar: z.string().or(z.literal("")),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    password: newPasswordSchema,
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function ProfilePage() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: authUser?.firstName ?? "",
      lastName: authUser?.lastName ?? "",
      phone: "",
      dateOfBirth: "",
      avatar: "",
    },
  });

  const pwForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", password: "", confirm: "" },
  });
  const newPw = pwForm.watch("password");

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
          phone: res.data.phone ?? "",
          dateOfBirth: toDateInputValue(res.data.dateOfBirth),
          avatar: resolveProfileImageUrl(res.data.profileImagePath),
        });
        setAvatarFile(null);
      } catch (err) {
        notifyApiError(err, "Failed to load profile");
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  const initials = useMemo(() => {
    const name =
      `${authUser?.firstName ?? ""} ${authUser?.lastName ?? ""}`.trim() || authUser?.username || "";
    return name
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [authUser]);

  if (!authUser) return null;

  const jobTitle = apiUser?.userTypeName ?? "";
  const roleLabel = (apiUser?.roleNames ?? []).filter(Boolean).join(", ");

  async function onSaveProfile(values: ProfileValues) {
    if (!apiUser) return;
    try {
      const res = await usersService.update(
        apiUser.id,
        {
          email: apiUser.email,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          phone: values.phone.trim() || null,
          dateOfBirth: values.dateOfBirth.trim() || null,
          isActive: apiUser.isActive,
          userTypeId: apiUser.userTypeId,
          roleIds: apiUser.roleIds ?? [],
        },
        avatarFile,
      );
      setApiUser(res.data);
      profileForm.reset({
        firstName: res.data.firstName ?? "",
        lastName: res.data.lastName ?? "",
        phone: res.data.phone ?? "",
        dateOfBirth: toDateInputValue(res.data.dateOfBirth),
        avatar: resolveProfileImageUrl(res.data.profileImagePath),
      });
      setAvatarFile(null);
      queryClient.invalidateQueries({ queryKey: ["users", authUser.id] });
      toast.success("Profile updated");
    } catch (err) {
      notifyApiError(err, "Failed to update profile");
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
      notifyApiError(err, "Failed to change password");
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="My profile" subtitle="Your personal details, avatar and password." />

      <Form form={profileForm} onSubmit={onSaveProfile} className="card-elevated p-6 space-y-6">
        <AvatarUploadField<ProfileValues>
          name="avatar"
          layout="profile"
          initials={initials}
          title={`${authUser.firstName} ${authUser.lastName}`.trim() || authUser.username}
          subtitle={authUser.email}
          onFileChange={setAvatarFile}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <TextField<ProfileValues> name="firstName" label="First name" required maxLength={80} />
          <TextField<ProfileValues> name="lastName" label="Last name" required maxLength={80} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              value={authUser.email}
              disabled
              className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Job title</label>
            <input
              value={jobTitle}
              disabled
              className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Job title is managed by an administrator.
            </p>
          </div>
          <PhoneNumberField<ProfileValues> name="phone" label="Phone" placeholder="07700 900000" />
          <TextField<ProfileValues> name="dateOfBirth" label="Date of birth" type="date" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <input
              value={roleLabel}
              disabled
              className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">Assigned by an administrator.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <SubmitButton loadingText="Saving…" disabled={loadingUser || !apiUser}>
            {loadingUser ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </SubmitButton>
        </div>
      </Form>

      <Form form={pwForm} onSubmit={onChangePassword} className="card-elevated p-6 mt-6 space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold">Change password</h2>
        </div>
        <PasswordField<PasswordValues>
          name="currentPassword"
          label="Current password"
          required
          autoComplete="current-password"
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <PasswordField<PasswordValues>
            name="password"
            label="New password"
            required
            autoComplete="new-password"
          />
          <PasswordField<PasswordValues>
            name="confirm"
            label="Confirm new password"
            required
            autoComplete="new-password"
            showToggle={false}
          />
        </div>
        <PasswordRequirements password={newPw} />
        <div className="flex justify-end pt-2 border-t">
          <SubmitButton variant="outline" loadingText="Updating…">
            Update password
          </SubmitButton>
        </div>
      </Form>
    </div>
  );
}
