import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CreatableSearchableSelectField,
  CreatableSearchableMultiSelectField,
  TextField,
  TextareaField,
} from "@/components/form";
import { fetchCustomerOptions, fetchProjectAssigneeOptions } from "@/lib/user-dropdowns";
import { fetchSiteOptions } from "@/lib/site-dropdowns";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCodeInput,
} from "@/lib/field-validation";
import type { ProjectFormValues } from "@/lib/project-form";
import { useFormContext } from "react-hook-form";
import { RateOverrideFields } from "@/components/rates/RateOverrideFields";

type ProjectFormFieldsProps = {
  disabled?: boolean;
  /** When true, client cannot be changed (e.g. hierarchy wizard). */
  lockCustomer?: boolean;
  /** When true, site cannot be changed (e.g. hierarchy wizard). */
  lockSite?: boolean;
  /**
   * When true (default), Site waits for Client.
   * Daily Programme free navigation sets false so Site stays enabled.
   */
  gateChildSelectOnParent?: boolean;
  /**
   * Site Manager free-nav: when Client changes, clear Site then pick the first
   * site for that client (options still change with the parent).
   */
  autoSelectFirstChild?: boolean;
  customerSelectedLabel?: string | null;
  siteSelectedLabel?: string | null;
  assigneeSelectedLabels?: Record<string, string>;
};

export function ProjectFormFields({
  disabled,
  lockCustomer,
  lockSite,
  gateChildSelectOnParent = true,
  autoSelectFirstChild = false,
  customerSelectedLabel,
  siteSelectedLabel,
  assigneeSelectedLabels,
}: ProjectFormFieldsProps) {
  const form = useFormContext<ProjectFormValues>();
  const customerId = form.watch("customerId");
  const prevCustomerId = useRef<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(customerSelectedLabel ?? null);
  const [siteLabel, setSiteLabel] = useState<string | null>(siteSelectedLabel ?? null);

  useEffect(() => {
    if (customerSelectedLabel) setCustomerLabel(customerSelectedLabel);
  }, [customerSelectedLabel]);

  useEffect(() => {
    if (siteSelectedLabel) setSiteLabel(siteSelectedLabel);
  }, [siteSelectedLabel]);

  useEffect(() => {
    if (prevCustomerId.current === null) {
      prevCustomerId.current = customerId;
      return;
    }
    if (prevCustomerId.current === customerId) return;

    prevCustomerId.current = customerId;
    form.setValue("siteId", "");
    setSiteLabel(null);

    if (!autoSelectFirstChild || !customerId) return;

    let cancelled = false;
    void (async () => {
      const sites = await fetchSiteOptions("", customerId);
      const first = sites[0];
      if (cancelled || !first?.value) return;
      form.setValue("siteId", first.value, { shouldDirty: true, shouldValidate: true });
      setSiteLabel(first.label);
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, form, autoSelectFirstChild]);

  const fetchSites = useCallback(
    (search: string) => fetchSiteOptions(search, customerId),
    [customerId],
  );

  const selectedAssigneeLabels = useMemo(
    () => assigneeSelectedLabels ?? {},
    [assigneeSelectedLabels],
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <CreatableSearchableSelectField<ProjectFormValues>
          name="customerId"
          label="Client"
          required
          placeholder="Select client"
          searchPlaceholder="Search clients…"
          queryKey={["users", "customers", "dropdown", "project-form", customerId]}
          selectedLabel={customerLabel ?? customerSelectedLabel}
          fetchOptions={fetchCustomerOptions}
          lookupType={lockCustomer ? undefined : "customer"}
          onSelect={(option) => setCustomerLabel(option.label)}
          disabled={disabled || lockCustomer}
        />
        <CreatableSearchableSelectField<ProjectFormValues>
          name="siteId"
          label="Site"
          required
          placeholder={
            gateChildSelectOnParent && !customerId ? "Select client first" : "Select site"
          }
          searchPlaceholder="Search sites…"
          queryKey={["sites", "dropdown", "project-form", customerId]}
          selectedLabel={siteLabel ?? siteSelectedLabel}
          fetchOptions={fetchSites}
          lookupType={lockSite ? undefined : "site"}
          lookupContext={{ customerId, customerLabel: customerLabel ?? customerSelectedLabel ?? undefined }}
          onSelect={(option) => setSiteLabel(option.label)}
          disabled={disabled || lockSite || (gateChildSelectOnParent && !customerId)}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      <CreatableSearchableMultiSelectField<ProjectFormValues>
        name="assignedUserIds"
        label="Assign To"
        placeholder="Select CM, PM, or SM"
        searchPlaceholder="Search staff…"
        queryKey={["users", "project-assignees", "dropdown"]}
        fetchOptions={fetchProjectAssigneeOptions}
        selectedLabels={selectedAssigneeLabels}
        lookupType="projectAssignee"
        disabled={disabled}
      />
      <TextareaField<ProjectFormValues>
        name="description"
        label="Description"
        rows={2}
        maxLength={DESCRIPTION_MAX_LENGTH}
        disabled={disabled}
      />
      <RateOverrideFields
        disabled={disabled}
        title="Rate overrides"
        hint="Leave empty to inherit from the site (then client, then catalogue). Within parent budget saves immediately; above needs a per-item reason + Rate approvals."
      />
    </div>
  );
}
