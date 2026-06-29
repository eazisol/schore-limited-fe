import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Can, useCan } from "@/components/Can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ShieldCheck, Mail, RotateCcw, Save, Send, Lock } from "lucide-react";
import { PERMISSIONS, groupPermissions, type PermissionKey } from "@/lib/permissions";
import { rolesStore, useRoles, type RoleKey } from "@/lib/roles-store";
import { smtpStore, useSmtp } from "@/lib/smtp-store";
import { ROLE_LABEL, ROLE_BADGE, ROLES } from "@/lib/users-store";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Schore" }] }),
  component: SettingsPage,
});

const TABS = [
  { key: "roles",   label: "Roles & Permissions",  icon: ShieldCheck, perm: "settings.view" as PermissionKey },
  { key: "smtp",    label: "SMTP / Email",         icon: Mail,         perm: "smtp.manage" as PermissionKey },
] as const;

function SettingsPage() {
  const canView = useCan("settings.view");
  const [tab, setTab] = useState<typeof TABS[number]["key"]>("roles");

  if (!canView) return <Navigate to="/forbidden" />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage roles, permissions and platform configuration." />

      <div className="border-b border-border mb-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2",
              tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "roles" && <RolesTab />}
      {tab === "smtp" && <SmtpTab />}
    </div>
  );
}

/* ───────────── Roles & Permissions matrix ───────────── */

function RolesTab() {
  const roles = useRoles();
  const canEdit = useCan("permissions.manage");
  const groups = groupPermissions();

  function toggle(roleKey: RoleKey, perm: PermissionKey) {
    if (!canEdit) return;
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
          <Can permission="permissions.manage">
            <Button variant="outline" size="sm" onClick={() => {
              rolesStore.resetToDefaults();
              toast.success("Permissions reset to defaults");
            }}>
              <RotateCcw className="h-4 w-4" /> Reset to defaults
            </Button>
          </Can>
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

function SmtpTab() {
  const cfg = useSmtp();
  const canEdit = useCan("smtp.manage");
  const [draft, setDraft] = useState(cfg);

  if (!useCan("smtp.manage") && !useCan("settings.view")) {
    return <Navigate to="/forbidden" />;
  }

  function save() {
    if (!canEdit) return;
    if (!draft.host) return toast.error("Host is required");
    if (!draft.fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.fromEmail)) return toast.error("Enter a valid from address");
    if (draft.port < 1 || draft.port > 65535) return toast.error("Port must be 1–65535");
    smtpStore.update(draft);
    toast.success("SMTP configuration saved");
  }

  function testConnection() {
    if (!draft.host || !draft.fromEmail) return toast.error("Fill in host and from address before testing");
    toast.success("Test email queued", {
      description: `(Demo) Would attempt connection to ${draft.host}:${draft.port} as ${draft.username || draft.fromEmail}`,
    });
  }

  return (
    <div className="card-elevated p-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold">SMTP configuration</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Outbound email for password resets, invites and notifications.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span>Enabled</span>
          <Switch
            checked={draft.enabled}
            disabled={!canEdit}
            onCheckedChange={v => setDraft({ ...draft, enabled: v })}
          />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Field label="Host">
          <Input value={draft.host} onChange={e => setDraft({ ...draft, host: e.target.value })} placeholder="smtp.office365.com" disabled={!canEdit} />
        </Field>
        <Field label="Port">
          <Input type="number" value={draft.port} onChange={e => setDraft({ ...draft, port: Number(e.target.value) })} disabled={!canEdit} />
        </Field>
        <Field label="Username">
          <Input value={draft.username} onChange={e => setDraft({ ...draft, username: e.target.value })} placeholder="apikey or user@domain" disabled={!canEdit} autoComplete="off" />
        </Field>
        <Field label="Password">
          <Input type="password" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} disabled={!canEdit} autoComplete="new-password" />
        </Field>
        <Field label="From name">
          <Input value={draft.fromName} onChange={e => setDraft({ ...draft, fromName: e.target.value })} disabled={!canEdit} />
        </Field>
        <Field label="From email">
          <Input type="email" value={draft.fromEmail} onChange={e => setDraft({ ...draft, fromEmail: e.target.value })} disabled={!canEdit} />
        </Field>
        <Field label="Encryption">
          <select
            value={draft.encryption}
            onChange={e => setDraft({ ...draft, encryption: e.target.value as any })}
            disabled={!canEdit}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="none">None</option>
            <option value="ssl">SSL</option>
            <option value="tls">TLS / STARTTLS</option>
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
        <p className="text-[11px] text-muted-foreground">
          Credentials are stored locally in this browser only.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testConnection} disabled={!canEdit}>
            <Send className="h-4 w-4" /> Send test email
          </Button>
          <Button onClick={save} disabled={!canEdit}>
            <Save className="h-4 w-4" /> Save configuration
          </Button>
        </div>
      </div>

      {!canEdit && (
        <div className="mt-5 rounded-md border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" /> View-only. Required permission: <code className="font-mono">smtp.manage</code>.
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
