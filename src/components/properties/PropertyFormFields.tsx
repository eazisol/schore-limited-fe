import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import {
  TextField,
  SwitchField,
  PhoneNumberField,
  CreatableSearchableSelectField,
} from "@/components/form";
import type { PropertyFormValues } from "@/lib/property-form";
import { ADDRESS_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from "@/lib/field-validation";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import { fetchSiteOptions } from "@/lib/site-dropdowns";
import { fetchProjectOptions } from "@/lib/project-dropdowns";

const CONTACT_FIELD_MAX = 30;

export function PropertyFormFields({
  disabled = false,
  embedded = false,
  lockCustomer = false,
  lockSite = false,
  lockProject = false,
  gateChildSelectOnParent = true,
  autoSelectFirstChild = false,
  customerSelectedLabel,
  siteSelectedLabel,
  projectSelectedLabel,
  autoFocusPropertyName = false,
}: {
  disabled?: boolean;
  embedded?: boolean;
  /** When true, client cannot be changed (e.g. hierarchy wizard). */
  lockCustomer?: boolean;
  /** When true, site cannot be changed (e.g. hierarchy wizard). */
  lockSite?: boolean;
  /** When true, project cannot be changed (e.g. hierarchy wizard). */
  lockProject?: boolean;
  /**
   * When true (default), Site waits for Client and Project waits for Site.
   * Daily Programme free navigation sets false so all selects stay enabled.
   */
  gateChildSelectOnParent?: boolean;
  /**
   * Site Manager free-nav: when Client/Site changes, clear children then pick
   * the first option for each dependent dropdown.
   */
  autoSelectFirstChild?: boolean;
  customerSelectedLabel?: string | null;
  siteSelectedLabel?: string | null;
  projectSelectedLabel?: string | null;
  autoFocusPropertyName?: boolean;
}) {
  const { watch, setValue } = useFormContext<PropertyFormValues>();
  const customerId = watch("customerId");
  const siteId = watch("siteId");
  const prevCustomerId = useRef<string | null>(null);
  const prevSiteId = useRef<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(customerSelectedLabel ?? null);
  const [siteLabel, setSiteLabel] = useState<string | null>(siteSelectedLabel ?? null);
  const [projectLabel, setProjectLabel] = useState<string | null>(projectSelectedLabel ?? null);

  useEffect(() => {
    if (customerSelectedLabel) setCustomerLabel(customerSelectedLabel);
  }, [customerSelectedLabel]);

  useEffect(() => {
    if (siteSelectedLabel) setSiteLabel(siteSelectedLabel);
  }, [siteSelectedLabel]);

  useEffect(() => {
    if (projectSelectedLabel) setProjectLabel(projectSelectedLabel);
  }, [projectSelectedLabel]);

  useEffect(() => {
    if (prevCustomerId.current === null) {
      prevCustomerId.current = customerId;
      return;
    }
    if (prevCustomerId.current === customerId) return;

    prevCustomerId.current = customerId;
    prevSiteId.current = "";
    setValue("siteId", "");
    setValue("projectId", "");
    setSiteLabel(null);
    setProjectLabel(null);

    if (!autoSelectFirstChild || !customerId) return;

    let cancelled = false;
    void (async () => {
      const sites = await fetchSiteOptions("", customerId);
      const firstSite = sites[0];
      if (cancelled || !firstSite?.value) return;
      setValue("siteId", firstSite.value, { shouldDirty: true, shouldValidate: true });
      setSiteLabel(firstSite.label);
      prevSiteId.current = firstSite.value;

      const projects = await fetchProjectOptions("", firstSite.value, customerId);
      const firstProject = projects[0];
      if (cancelled || !firstProject?.value) return;
      setValue("projectId", firstProject.value, { shouldDirty: true, shouldValidate: true });
      setProjectLabel(firstProject.label);
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, setValue, autoSelectFirstChild]);

  useEffect(() => {
    if (prevSiteId.current === null) {
      prevSiteId.current = siteId;
      return;
    }
    if (prevSiteId.current === siteId) return;

    prevSiteId.current = siteId;
    setValue("projectId", "");
    setProjectLabel(null);

    if (!autoSelectFirstChild || !siteId) return;

    let cancelled = false;
    void (async () => {
      const projects = await fetchProjectOptions("", siteId, customerId);
      const first = projects[0];
      if (cancelled || !first?.value) return;
      setValue("projectId", first.value, { shouldDirty: true, shouldValidate: true });
      setProjectLabel(first.label);
    })();

    return () => {
      cancelled = true;
    };
  }, [siteId, customerId, setValue, autoSelectFirstChild]);

  const fetchSites = useCallback(
    (search: string) => fetchSiteOptions(search, customerId),
    [customerId],
  );

  const fetchProjects = useCallback(
    (search: string) => fetchProjectOptions(search, siteId, customerId),
    [siteId, customerId],
  );

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <Section
        embedded={embedded}
        headerAction={
          embedded ? undefined : <SwitchField<PropertyFormValues> name="isActive" label="Active" />
        }
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <CreatableSearchableSelectField<PropertyFormValues>
            name="customerId"
            label="Client"
            placeholder="Select client"
            searchPlaceholder="Search clients…"
            queryKey={["users", "customers", "dropdown", customerId]}
            selectedLabel={customerSelectedLabel ?? customerLabel}
            fetchOptions={fetchCustomerOptions}
            lookupType={lockCustomer ? undefined : "customer"}
            onSelect={(option) => setCustomerLabel(option.label)}
            disabled={lockCustomer}
          />
          <CreatableSearchableSelectField<PropertyFormValues>
            name="siteId"
            label="Site"
            required
            placeholder={
              gateChildSelectOnParent && !customerId ? "Select client first" : "Select site"
            }
            searchPlaceholder="Search sites…"
            queryKey={["sites", "dropdown", customerId]}
            selectedLabel={siteSelectedLabel ?? siteLabel}
            fetchOptions={fetchSites}
            disabled={lockSite || (gateChildSelectOnParent && !customerId)}
            lookupType={lockSite ? undefined : "site"}
            lookupContext={{ customerId, customerLabel }}
            onSelect={(option) => setSiteLabel(option.label)}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <CreatableSearchableSelectField<PropertyFormValues>
            name="projectId"
            label="Project"
            required
            placeholder={
              gateChildSelectOnParent && !siteId ? "Select site first" : "Select project"
            }
            searchPlaceholder="Search projects…"
            queryKey={["projects", "dropdown", siteId, customerId]}
            selectedLabel={projectLabel ?? projectSelectedLabel}
            fetchOptions={fetchProjects}
            onSelect={(option) => setProjectLabel(option.label)}
            disabled={lockProject || (gateChildSelectOnParent && !siteId)}
            lookupType={lockProject ? undefined : "project"}
            lookupContext={{ siteId, siteLabel, customerId }}
          />
          <TextField<PropertyFormValues>
            name="propertyName"
            label="Property name"
            required
            autoFocus={autoFocusPropertyName}
            maxLength={NAME_MAX_LENGTH}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <TextField<PropertyFormValues>
            name="accessNotes"
            label="Access notes"
            maxLength={DESCRIPTION_MAX_LENGTH}
          />
        </div>
      </Section>

      <Section title="Contact & address" embedded={embedded} separated={embedded}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <TextField<PropertyFormValues>
            name="contactName"
            label="Contact name"
            required
            maxLength={CONTACT_FIELD_MAX}
          />
          <PhoneNumberField<PropertyFormValues>
            name="contactPhoneNo"
            label="Contact phone"
            placeholder="07700 900000"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <TextField<PropertyFormValues>
            name="contactEmail"
            label="Contact email"
            type="email"
            placeholder="name@schore.co.uk"
          />
          <TextField<PropertyFormValues>
            name="address"
            label="Address"
            required
            maxLength={ADDRESS_MAX_LENGTH}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <TextField<PropertyFormValues> name="city" label="City" maxLength={100} />
          <TextField<PropertyFormValues> name="state" label="State" maxLength={100} />
          <TextField<PropertyFormValues> name="country" label="Country" maxLength={100} />
          <TextField<PropertyFormValues> name="zipCode" label="ZIP Code" maxLength={20} />
        </div>
      </Section>
    </fieldset>
  );
}

function Section({
  title,
  headerAction,
  embedded,
  separated,
  children,
}: {
  title?: string;
  headerAction?: ReactNode;
  embedded?: boolean;
  separated?: boolean;
  children: ReactNode;
}) {
  if (embedded) {
    return (
      <div className={cn("space-y-2", separated && "border-t border-border pt-3")}>
        {title ? <h3 className="font-display text-sm font-semibold">{title}</h3> : null}
        {children}
      </div>
    );
  }

  const showHeader = title || headerAction;
  return (
    <div className="card-elevated space-y-2 p-4 sm:p-6">
      {showHeader ? (
        <div
          className={
            title ? "flex items-center justify-between gap-4" : "flex items-center justify-end gap-4"
          }
        >
          {title ? <h3 className="font-display font-semibold">{title}</h3> : null}
          {headerAction}
        </div>
      ) : null}
      {children}
    </div>
  );
}
