import { useCallback, useEffect, useRef, useState } from "react";
import {
  CreatableSearchableSelectField,
  TextField,
  TextareaField,
} from "@/components/form";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import { fetchSiteOptions } from "@/lib/site-dropdowns";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCodeInput,
} from "@/lib/field-validation";
import type { ProjectFormValues } from "@/lib/project-form";
import { useFormContext } from "react-hook-form";

type ProjectFormFieldsProps = {
  disabled?: boolean;
  customerSelectedLabel?: string | null;
  siteSelectedLabel?: string | null;
};

export function ProjectFormFields({
  disabled,
  customerSelectedLabel,
  siteSelectedLabel,
}: ProjectFormFieldsProps) {
  const form = useFormContext<ProjectFormValues>();
  const customerId = form.watch("customerId");
  const prevCustomerId = useRef<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(customerSelectedLabel ?? null);
  const [siteLabel, setSiteLabel] = useState<string | null>(siteSelectedLabel ?? null);

  useEffect(() => {
    if (prevCustomerId.current === null) {
      prevCustomerId.current = customerId;
      return;
    }
    if (prevCustomerId.current !== customerId) {
      form.setValue("siteId", "");
      setSiteLabel(null);
      prevCustomerId.current = customerId;
    }
  }, [customerId, form]);

  const fetchSites = useCallback(
    (search: string) => fetchSiteOptions(search, customerId),
    [customerId],
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <CreatableSearchableSelectField<ProjectFormValues>
          name="customerId"
          label="Client"
          required
          placeholder="Select client"
          searchPlaceholder="Search clients…"
          queryKey={["users", "customers", "dropdown", "project-form", customerId]}
          selectedLabel={customerLabel ?? customerSelectedLabel}
          fetchOptions={fetchCustomerOptions}
          lookupType="customer"
          onSelect={(option) => setCustomerLabel(option.label)}
          disabled={disabled}
        />
        <CreatableSearchableSelectField<ProjectFormValues>
          name="siteId"
          label="Site"
          required
          placeholder={customerId ? "Select site" : "Select client first"}
          searchPlaceholder="Search sites…"
          queryKey={["sites", "dropdown", "project-form", customerId]}
          selectedLabel={siteLabel ?? siteSelectedLabel}
          fetchOptions={fetchSites}
          lookupType="site"
          lookupContext={{ customerId, customerLabel: customerLabel ?? customerSelectedLabel ?? undefined }}
          onSelect={(option) => setSiteLabel(option.label)}
          disabled={disabled || !customerId}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<ProjectFormValues>
          name="name"
          label="Name"
          required
          maxLength={NAME_MAX_LENGTH}
          disabled={disabled}
        />
        <TextField<ProjectFormValues>
          name="code"
          label="Code"
          required
          maxLength={CODE_MAX_LENGTH}
          transformValue={normalizeCodeInput}
          inputClassName="uppercase"
          disabled={disabled}
        />
      </div>
      <TextareaField<ProjectFormValues>
        name="description"
        label="Description"
        rows={3}
        maxLength={DESCRIPTION_MAX_LENGTH}
        disabled={disabled}
      />
    </div>
  );
}
