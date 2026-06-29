import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, type FormEvent } from "react";
import { toast } from "sonner";
import { Camera, Save, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authStore, useAuthSession } from "@/lib/auth-store";
import { usersStore, ROLE_LABEL, ROLE_BADGE } from "@/lib/users-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My profile — Schore" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  useAuthSession();
  const user = authStore.getUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwErr, setPwErr] = useState<string | undefined>();

  if (!user) return null;
  const initials = user.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  function onSaveProfile(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim() || name.trim().length < 2) return toast.error("Name must be at least 2 characters");
    if (phone && !/^[\d +()-]{7,20}$/.test(phone.trim())) return toast.error("Enter a valid phone number");
    usersStore.update(user!.id, { name: name.trim(), phone: phone.trim() || undefined, jobTitle: jobTitle.trim() || undefined, avatar: avatar || undefined });
    toast.success("Profile updated");
  }

  async function onChangePassword(ev: FormEvent) {
    ev.preventDefault();
    setPwErr(undefined);
    if (pw.length < 8) return setPwErr("Must be at least 8 characters");
    if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return setPwErr("Include one uppercase letter and one number");
    if (pw !== pw2) return setPwErr("Passwords do not match");
    await authStore.setPassword(user!.id, pw);
    setPw(""); setPw2("");
    toast.success("Password changed");
  }

  function onAvatarPick(file: File | null) {
    if (!file) return;
    if (file.size > 1024 * 1024) return toast.error("Avatar must be under 1 MB");
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="My profile" subtitle="Your personal details, avatar and password." />

      <form onSubmit={onSaveProfile} className="card-elevated p-6 space-y-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            {avatar ? (
              <img src={avatar} alt="" className="h-20 w-20 rounded-full object-cover border" />
            ) : (
              <div className="h-20 w-20 rounded-full grid place-items-center bg-accent/90 text-accent-foreground text-xl font-semibold">{initials}</div>
            )}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-7 w-7 grid place-items-center rounded-full bg-card border shadow-sm hover:bg-accent/10"
              aria-label="Change avatar">
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onAvatarPick(e.target.files?.[0] ?? null)} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold text-lg truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <span className={cn("mt-1.5 inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border", ROLE_BADGE[user.role])}>
              {ROLE_LABEL[user.role]}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (read-only)</Label>
            <Input id="email" value={user.email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07700 900000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job">Job title</Label>
            <Input id="job" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit"><Save className="h-4 w-4" /> Save changes</Button>
        </div>
      </form>

      <form onSubmit={onChangePassword} className="card-elevated p-6 mt-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold">Change password</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="newpw">New password</Label>
            <Input id="newpw" type="password" value={pw} onChange={e => { setPw(e.target.value); setPwErr(undefined); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newpw2">Confirm</Label>
            <Input id="newpw2" type="password" value={pw2} onChange={e => { setPw2(e.target.value); setPwErr(undefined); }} />
          </div>
        </div>
        {pwErr && <p className="text-xs text-destructive">{pwErr}</p>}
        <div className="flex justify-end">
          <Button type="submit" variant="outline">Update password</Button>
        </div>
      </form>
    </div>
  );
}
