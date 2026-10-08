import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  TextField,
  PhoneNumberField,
  ImageUploadField,
  SubmitButton,
} from "@/components/form";
import { getPhoneLengthError } from "@/components/form/PhoneNumberField";
import { settingsService } from "@/lib/api/services/settings";
import { notifyApiError } from "@/lib/api/axios";
import { brandingQueryKey } from "@/lib/branding";
import { ADDRESS_MAX_LENGTH } from "@/lib/field-validation";
import { hasCeoRole } from "@/lib/user-capabilities";
import { usePermissions } from "@/contexts/PermissionContext";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_FORMAT = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-.~:/?#[\]@!$&'()*+,;=%]*)?$/i;

const brandingSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200, "Company name must be 200 characters or fewer"),
  logo: z.string(),
  address: z.string().trim().max(ADDRESS_MAX_LENGTH, `Address must be ${ADDRESS_MAX_LENGTH} characters or fewer`),
  city: z.string().trim().max(100, "City must be 100 characters or fewer"),
  state: z.string().trim().max(100, "State must be 100 characters or fewer"),
  country: z.string().trim().max(100, "Country must be 100 characters or fewer"),
  zipCode: z.string().trim().max(20, "ZIP Code must be 20 characters or fewer"),
  phone: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) return;
      if (getPhoneLengthError(value, undefined, { requireMin: true })) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid phone number for the selected country.",
        });
      }
    }),
  email: z
    .string()
    .trim()
    .max(200, "Email must be 200 characters or fewer")
    .superRefine((value, ctx) => {
      if (!value) return;
      if (!EMAIL_FORMAT.test(value)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid email address" });
      }
    }),
  website: z
    .string()
    .trim()
    .max(300, "Website must be 300 characters or fewer")
    .superRefine((value, ctx) => {
      if (!value) return;
      if (!WEBSITE_FORMAT.test(value)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid website URL" });
      }
    }),
});

type BrandingValues = z.infer<typeof brandingSchema>;

const BRANDING_DEFAULTS: BrandingValues = {
  companyName: "",
  logo: "",
  address: "",
  city: "",
  state: "",
  country: "",
  zipCode: "",
  phone: "",
  email: "",
  website: "",
};

export function BrandingColumn() {
  const queryClient = useQueryClient();
  const { access } = usePermissions();
  const canEdit = hasCeoRole(access?.roleCodes);
  const [loading, setLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);
  const form = useForm<BrandingValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: BRANDING_DEFAULTS,
  });

  useEffect(() => {
    if (!canEdit) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await settingsService.getBranding();
        if (cancelled) return;
        const d = res?.data;
        if (d) {
          const companyName = d.companyName ?? "";
          setHasExisting(Boolean(companyName.trim()));
          form.reset({
            companyName,
            logo: d.logo ?? "",
            address: d.address ?? "",
            city: d.city ?? "",
            state: d.state ?? "",
            country: d.country ?? "",
            zipCode: d.zipCode ?? "",
            phone: d.phone ?? "",
            email: d.email ?? "",
            website: d.website ?? "",
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
  }, [canEdit]);

  async function save(values: BrandingValues) {
    if (!canEdit) return;
    try {
      const website = values.website.trim();
      const res = await settingsService.updateBranding({
        companyName: values.companyName,
        logo: values.logo,
        address: values.address,
        city: values.city,
        state: values.state,
        country: values.country,
        zipCode: values.zipCode,
        phone: values.phone,
        email: values.email,
        website,
        isActive: true,
      });
      const d = res.data;
      if (d) {
        form.reset({
          companyName: d.companyName ?? "",
          logo: d.logo ?? "",
          address: d.address ?? "",
          city: d.city ?? "",
          state: d.state ?? "",
          country: d.country ?? "",
          zipCode: d.zipCode ?? "",
          phone: d.phone ?? "",
          email: d.email ?? "",
          website: d.website ?? "",
        });
        queryClient.setQueryData(brandingQueryKey, d);
      }
      await queryClient.invalidateQueries({ queryKey: brandingQueryKey });
      setHasExisting(true);
      toast.success(res.message || "Branding saved");
    } catch (err) {
      notifyApiError(err, "Failed to save branding");
    }
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">Only the CEO can manage company branding.</p>
    );
  }

  return (
    <Form form={form} onSubmit={save} className="card-elevated max-w-2xl space-y-3 p-4">
      <ImageUploadField<BrandingValues>
        name="logo"
        label="Logo"
        maxSizeKb={2048}
        allowedExtensions={["png", "jpg", "jpeg", "webp"]}
        disabled={!canEdit || loading}
        className="space-y-0.5"
      />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <TextField<BrandingValues>
          name="companyName"
          label="Company name"
          required
          maxLength={200}
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
        <TextField<BrandingValues>
          name="address"
          label="Address"
          maxLength={ADDRESS_MAX_LENGTH}
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <TextField<BrandingValues>
          name="city"
          label="City"
          maxLength={100}
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
        <TextField<BrandingValues>
          name="state"
          label="State"
          maxLength={100}
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
        <TextField<BrandingValues>
          name="country"
          label="Country"
          maxLength={100}
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
        <TextField<BrandingValues>
          name="zipCode"
          label="ZIP Code"
          maxLength={20}
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <PhoneNumberField<BrandingValues>
          name="phone"
          label="Phone number"
          placeholder="07700 900000"
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
        <TextField<BrandingValues>
          name="email"
          label="Email"
          type="email"
          maxLength={200}
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <TextField<BrandingValues>
          name="website"
          label="Website"
          placeholder="Optional"
          maxLength={300}
          disabled={!canEdit || loading}
          className="space-y-0.5"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-2">
        <div className="text-xs text-muted-foreground">
          {hasExisting ? "Existing branding loaded." : "No branding configured yet."}
        </div>

        <SubmitButton disabled={!canEdit || loading} loadingText="Saving…">
          <Save className="h-4 w-4" /> Save branding
        </SubmitButton>
      </div>
    </Form>
  );
}
