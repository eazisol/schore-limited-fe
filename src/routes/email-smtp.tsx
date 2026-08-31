import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/AppShell";
import { settingsService } from "@/lib/api/services/settings";
import { notifyApiError } from "@/lib/api/axios";
import {
  Form,
  TextField,
  SwitchField,
  PasswordField,
  SubmitButton,
} from "@/components/form";
import { usePermission } from "@/components/Permission";
import { EMAIL_SMTP_ROUTE } from "@/lib/email-smtp";

export const Route = createFileRoute("/email-smtp")({
  head: () => ({ meta: [{ title: "Email SMTP | Schore" }] }),
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
  host: "",
  port: 587,
  username: "",
  password: "",
  fromName: "",
  fromEmail: "",
  enableSsl: true,
  enabled: true,
};

function EmailSmtpPage() {
  const canEdit = usePermission({ route: EMAIL_SMTP_ROUTE, action: "modify" });
  const [loading, setLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);
  const form = useForm<SmtpValues>({
    resolver: zodResolver(smtpSchema),
    defaultValues: SMTP_DEFAULTS,
  });

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
    return () => {
      cancelled = true;
    };
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

  return (
    <div>
      <PageHeader title="Email SMTP" />

      <Form form={form} onSubmit={save} className="card-elevated max-w-3xl space-y-6 p-6">
        <p className="text-xs text-muted-foreground">
          Outbound email for password resets, invites and notifications.
        </p>

        <SwitchField<SmtpValues>
          name="enabled"
          label="SMTP enabled"
          disabled={!canEdit || loading}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField<SmtpValues>
            name="fromEmail"
            label="Email"
            required
            type="email"
            disabled={!canEdit || loading}
          />
          <PasswordField<SmtpValues>
            name="password"
            label="Password"
            autoComplete="new-password"
            disabled={!canEdit || loading}
          />
          <TextField<SmtpValues>
            name="host"
            label="Host"
            required
            placeholder="smtp.office365.com"
            disabled={!canEdit || loading}
          />
          <TextField<SmtpValues>
            name="port"
            label="Port"
            required
            type="number"
            disabled={!canEdit || loading}
          />
          <TextField<SmtpValues>
            name="fromName"
            label="Name"
            required
            disabled={!canEdit || loading}
          />
          <SwitchField<SmtpValues>
            name="enableSsl"
            label="Enable SSL"
            layout="stacked"
            disabled={!canEdit || loading}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-2">
          <div className="text-xs text-muted-foreground">
            {hasExisting ? "Existing configuration loaded." : "No configuration yet."}
          </div>

          <SubmitButton disabled={!canEdit || loading} loadingText="Saving…">
            <Save className="h-4 w-4" /> Save configuration
          </SubmitButton>
        </div>
      </Form>
    </div>
  );
}
