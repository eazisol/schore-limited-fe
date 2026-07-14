import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Can, useCan } from "@/components/Can";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ShieldCheck, Mail, RotateCcw, Save, Send, Lock, Palette } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PERMISSIONS, groupPermissions, type PermissionKey } from "@/lib/permissions";
import { rolesStore, useRoles, type RoleKey } from "@/lib/roles-store";

import { brandingStore, useBranding } from "@/lib/branding-store";
import { ROLE_LABEL, ROLE_BADGE, ROLES } from "@/lib/users-store";
import { settingsService } from "@/lib/api/services/settings";
import type { ApiError } from "@/lib/api/axios";
import {
  Form, TextField, SelectField, SwitchField, PasswordField, AvatarUploadField, SubmitButton,
} from "@/components/form";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Schore" }] }),
  component: SettingsPage,
});

const TABS = [
  { key: "general", label: "General & Branding",      icon: Palette,      perm: "settings.view" as PermissionKey },
  { key: "roles",   label: "Roles & Permissions",     icon: ShieldCheck,  perm: "settings.view" as PermissionKey },
  { key: "smtp",    label: "SMTP / Email",            icon: Mail,         perm: "smtp.manage"   as PermissionKey },
] as const;

function SettingsPage() {
  const [tab, setTab] = useState<typeof TABS[number]["key"]>("general");

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage branding, roles, permissions and platform configuration." />

      <div className="border-b border-border mb-6 flex gap-1 overflow-x-auto overflow-y-hidden">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap",
              tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && <GeneralTab />}
      {tab === "roles"   && <RolesTab />}
      {tab === "smtp"    && <SmtpTab />}
    </div>
  );
}

/* ───────────── General & Branding ───────────── */

const brandingSchema = z.object({
  appName: z.string().trim().min(1, "App name is required").max(60),
  tagline: z.string().trim().max(80).or(z.literal("")),
  supportEmail: z.string().trim().email("Enter a valid email address"),
  logo: z.string().or(z.literal("")),
});
type BrandingValues = z.infer<typeof brandingSchema>;

function GeneralTab() {
  const cfg = useBranding();
  const canEdit = true;
  const form = useForm<BrandingValues>({ resolver: zodResolver(brandingSchema), defaultValues: cfg });
  useEffect(() => { form.reset(cfg); }, [cfg, form]);

  async function save(values: BrandingValues) {
    brandingStore.update(values);
    toast.success("Branding updated");
  }

  return (
    <Form form={form} onSubmit={save} className="card-elevated p-6 max-w-3xl space-y-6">
      <div>
        <h3 className="font-display font-semibold">General & Branding</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Basic identity used across the sign-in screen and system emails.
        </p>
      </div>

      <AvatarUploadField<BrandingValues>
        name="logo"
        label="Logo"
        description="Square PNG or SVG recommended. Max 1 MB."
        initials={cfg.appName.slice(0, 2).toUpperCase()}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <TextField<BrandingValues> name="appName" label="App name" required maxLength={60} disabled={!canEdit} />
        <TextField<BrandingValues> name="tagline" label="Tagline" placeholder="Workforce & Payroll" maxLength={80} disabled={!canEdit} />
        <TextField<BrandingValues> name="supportEmail" label="Support email" required type="email" disabled={!canEdit} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => { brandingStore.reset(); toast.success("Branding reset to defaults"); }}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
        <SubmitButton loadingText="Saving…"><Save className="h-4 w-4" /> Save changes</SubmitButton>
      </div>
    </Form>
  );
}

/* ───────────── Roles & Permissions matrix ───────────── */

function RolesTab() {
  const roles = useRoles();
  const canEdit = true;
  const groups = groupPermissions();

  function toggle(roleKey: RoleKey, perm: PermissionKey) {
    rolesStore.togglePermission(roleKey, perm);
  }

  return (
    <div className="space-y-6">
      <div className="card-elevated p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-display font-semibold">Role × Permission matrix</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Permissions drive menus, pages and actions across the platform. Changes apply immediately.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            rolesStore.resetToDefaults();
            toast.success("Permissions reset to defaults");
          }}>
            <RotateCcw className="h-4 w-4" /> Reset to defaults
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {roles.map(r => (
          <div key={r.key} className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <span className={cn("inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border", ROLE_BADGE[r.key])}>
                {r.key}
              </span>
              <span className="text-xs text-muted-foreground">{r.permissions.length} perms</span>
            </div>
            <div className="font-display font-semibold mt-2">{r.name}</div>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{r.description}</p>
          </div>
        ))}
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-5 py-2.5 sticky left-0 bg-muted/40">Permission</th>
              {ROLES.map(r => (
                <th key={r} className="text-center font-medium px-3 py-2.5 min-w-[110px]">
                  <div className="font-semibold text-foreground">{r}</div>
                  <div className="text-[10px] font-normal">{ROLE_LABEL[r]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Object.entries(groups).map(([category, perms]) => (
              <PermGroup key={category} category={category} perms={perms} roles={roles} canEdit={canEdit} onToggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>

      {!canEdit && (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" /> You can view this matrix but not edit it. Required permission: <code className="font-mono">permissions.manage</code>.
        </div>
      )}
    </div>
  );
}

function PermGroup({
  category, perms, roles, canEdit, onToggle,
}: {
  category: string;
  perms: typeof PERMISSIONS[number][];
  roles: ReturnType<typeof useRoles>;
  canEdit: boolean;
  onToggle: (r: RoleKey, p: PermissionKey) => void;
}) {
  return (
    <>
      <tr className="bg-muted/20">
        <td colSpan={1 + ROLES.length} className="px-5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {category}
        </td>
      </tr>
      {perms.map(p => (
        <tr key={p.key} className="hover:bg-muted/20">
          <td className="px-5 py-2 sticky left-0 bg-background">
            <div className="text-sm">{p.label}</div>
            <code className="text-[10px] text-muted-foreground font-mono">{p.key}</code>
          </td>
          {roles.map(r => {
            const has = r.permissions.includes(p.key);
            return (
              <td key={r.key} className="px-3 py-2 text-center">
                <Checkbox
                  checked={has}
                  disabled={!canEdit}
                  onCheckedChange={() => onToggle(r.key, p.key)}
                  aria-label={`${r.key} ${p.key}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

/* ───────────── SMTP tab ───────────── */

const smtpSchema = z.object({
  host: z.string().trim().min(1, "Host is required"),
  port: z.coerce.number().int().min(1, "Port must be 1–65535").max(65535, "Port must be 1–65535"),
  username: z.string().trim().or(z.literal("")),
  password: z.string().or(z.literal("")),
  fromName: z.string().trim().min(1, "From name is required"),
  fromEmail: z.string().trim().email("Enter a valid email address"),
  enableSsl: z.boolean(),
  enabled: z.boolean(),
});
type SmtpValues = z.infer<typeof smtpSchema>;

const SMTP_DEFAULTS: SmtpValues = {
  host: "", port: 587, username: "", password: "",
  fromName: "", fromEmail: "", enableSsl: true, enabled: true,
};

function SmtpTab() {
  const canEdit = useCan("smtp.manage");
  const canView = useCan("settings.view");
  const [loading, setLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);
  const form = useForm<SmtpValues>({ resolver: zodResolver(smtpSchema), defaultValues: SMTP_DEFAULTS });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await settingsService.getEmail();
        if (cancelled) return;
        const d = res?.data;
        if (d) {
          setHasExisting(true);
          form.reset({
            host: d.host ?? "",
            port: Number(d.port ?? 587),
            username: d.username ?? "",
            password: d.password ?? "",
            fromName: d.fromName ?? "",
            fromEmail: d.fromEmail ?? "",
            enableSsl: Boolean(d.enableSsl ?? true),
            enabled: Boolean(d.isActive ?? true),
          });
        }
      } catch {
        /* interceptor toasts */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canEdit && !canView) {
    return <Navigate to="/forbidden" />;
  }

  async function save(values: SmtpValues) {
    if (!canEdit) return;
    try {
      await settingsService.updateEmail({
        host: values.host,
        port: Number(values.port),
        username: values.username,
        password: values.password,
        fromEmail: values.fromEmail,
        fromName: values.fromName,
        enableSsl: values.enableSsl,
        isActive: values.enabled,
      });
      setHasExisting(true);
      toast.success("SMTP configuration saved");
    } catch (err) {
      const e = err as ApiError;
      toast.error(e?.message || "Failed to save SMTP configuration");
    }
  }

  function testConnection() {
    const v = form.getValues();
    if (!v.host || !v.fromEmail) return toast.error("Fill in host and from address before testing");
    toast.success("Test email queued", {
      description: `(Demo) Would attempt connection to ${v.host}:${v.port} as ${v.username || v.fromEmail}`,
    });
  }


  return (
    <Form form={form} onSubmit={save} className="card-elevated p-6 max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold">SMTP configuration</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Outbound email for password resets, invites and notifications.
          </p>
        </div>
      </div>

      <SwitchField<SmtpValues>
        name="enabled"
        label="SMTP enabled"
        description="Turn on to route outgoing emails through this server."
        disabled={!canEdit || loading}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <TextField<SmtpValues> name="host" label="Host" required placeholder="smtp.office365.com" disabled={!canEdit || loading} />
        <TextField<SmtpValues> name="port" label="Port" required type="number" disabled={!canEdit || loading} />
        <TextField<SmtpValues> name="username" label="Username" placeholder="apikey or user@domain" autoComplete="off" disabled={!canEdit || loading} />
        <PasswordField<SmtpValues> name="password" label="Password" autoComplete="new-password" disabled={!canEdit || loading} />
        <TextField<SmtpValues> name="fromName" label="From name" required disabled={!canEdit || loading} />
        <TextField<SmtpValues> name="fromEmail" label="From email" required type="email" disabled={!canEdit || loading} />
        <SwitchField<SmtpValues>
          name="enableSsl"
          label="Enable SSL"
          description="Use SSL/TLS when connecting to the SMTP server."
          disabled={!canEdit || loading}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
        <div className="text-xs text-muted-foreground">
          {hasExisting ? "Existing configuration loaded." : "No configuration yet."}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={testConnection} disabled={!canEdit || loading}>
            <Send className="h-4 w-4" /> Send test email
          </Button>
          <SubmitButton disabled={!canEdit || loading} loadingText="Saving…">
            <Save className="h-4 w-4" /> Save configuration
          </SubmitButton>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" /> View-only. Required permission: <code className="font-mono">smtp.manage</code>.
        </div>
      )}
    </Form>
  );
}

