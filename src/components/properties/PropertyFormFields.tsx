import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  TextField,
  SwitchField,
  PhoneNumberField,
  CreatableSearchableSelectField,
} from "@/components/form";
import type { PropertyFormValues } from "@/lib/property-form";
import { ADDRESS_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from "@/lib/field-validation";
import { fetchContractorOptions, fetchCustomerOptions } from "@/lib/user-dropdowns";

const CONTACT_FIELD_MAX = 30;

export function PropertyFormFields({
  disabled = false,
  embedded = false,
  customerSelectedLabel,
  contractorSelectedLabel,
  autoFocusPropertyName = false,
}: {
  disabled?: boolean;
  embedded?: boolean;
  customerSelectedLabel?: string | null;
  contractorSelectedLabel?: string | null;
  autoFocusPropertyName?: boolean;
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <Section
        embedded={embedded}
        headerAction={
          embedded ? undefined : <SwitchField<PropertyFormValues> name="isActive" label="Active" />
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField<PropertyFormValues>
            name="propertyName"
            label="Property name"
            required
            autoFocus={autoFocusPropertyName}
            maxLength={NAME_MAX_LENGTH}
          />
          <CreatableSearchableSelectField<PropertyFormValues>
            name="contractorId"
            label="Contractor"
            placeholder="Select contractor"
            searchPlaceholder="Search contractors…"
            queryKey={["users", "contractors", "dropdown"]}
            selectedLabel={contractorSelectedLabel}
            fetchOptions={fetchContractorOptions}
            lookupType="contractor"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <CreatableSearchableSelectField<PropertyFormValues>
            name="customerId"
            label="Customer"
            placeholder="Select customer"
            searchPlaceholder="Search customers…"
            queryKey={["users", "customers", "dropdown"]}
            selectedLabel={customerSelectedLabel}
            fetchOptions={fetchCustomerOptions}
            lookupType="customer"
          />
          <TextField<PropertyFormValues>
            name="accessNotes"
            label="Access notes"
            maxLength={DESCRIPTION_MAX_LENGTH}
          />
        </div>
      </Section>

      <Section title="Contact & address" embedded={embedded} separated={embedded}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className={cn("space-y-3", separated && "border-t border-border pt-6")}>
        {title ? <h3 className="font-display text-base font-semibold">{title}</h3> : null}
        {children}
      </div>
    );
  }

  const showHeader = title || headerAction;
  return (
    <div className="card-elevated space-y-3 p-4 sm:p-6">
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
