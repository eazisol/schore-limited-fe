import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Save, Send } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsService } from "@/lib/api/services/settings";
import { notifyApiError } from "@/lib/api/axios";
import {
  Form, TextField, SwitchField, PasswordField, SubmitButton,
} from "@/components/form";
import { usePathPermission } from "@/components/Permission";

export const Route = createFileRoute("/settings/email-smtp")({
  head: () => ({ meta: [{ title: "Email SMTP | Settings" }] }),
  component: EmailSmtpPage,
});

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

function EmailSmtpPage() {
  const canEdit = usePathPermission("modify");
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
            username: "",
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

  async function save(values: SmtpValues) {
    if (!canEdit) return;
    try {
      const res = await settingsService.updateEmail({
        host: values.host,
        port: Number(values.port),
        username: "",
        password: values.password,
        fromEmail: values.fromEmail,
        fromName: values.fromName,
        enableSsl: values.enableSsl,
        isActive: values.enabled,
      });
      setHasExisting(true);
      toast.success(res.message || "SMTP configuration saved");
    } catch (err) {
      notifyApiError(err, "Failed to save SMTP configuration");
    }
  }

  function testConnection() {
    const v = form.getValues();
    if (!v.host || !v.fromEmail) return toast.error("Fill in host and from address before testing");
    toast.success("Test email queued", {
      description: `(Demo) Would attempt connection to ${v.host}:${v.port} as ${v.fromEmail}`,
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
        <TextField<SmtpValues> name="fromEmail" label="Email" required type="email" disabled={!canEdit || loading} />
        <PasswordField<SmtpValues> name="password" label="Password" autoComplete="new-password" disabled={!canEdit || loading} />
        <TextField<SmtpValues> name="host" label="Host" required placeholder="smtp.office365.com" disabled={!canEdit || loading} />
        <TextField<SmtpValues> name="port" label="Port" required type="number" disabled={!canEdit || loading} />
        <TextField<SmtpValues> name="fromName" label="Name" required disabled={!canEdit || loading} />
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
    </Form>
  );
}
