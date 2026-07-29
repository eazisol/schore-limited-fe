import type { ReactNode } from "react";
import {
  TextField,
  TextareaField,
  SwitchField,
  PhoneNumberField,
  SearchableSelectField,
} from "@/components/form";
import type { PropertyFormValues } from "@/lib/property-form";
import { ADDRESS_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from "@/lib/field-validation";
import { fetchContractorOptions, fetchCustomerOptions } from "@/lib/user-dropdowns";

const CONTACT_FIELD_MAX = 30;

export function PropertyFormFields({
  disabled = false,
  customerSelectedLabel,
  contractorSelectedLabel,
  autoFocusPropertyName = false,
}: {
  disabled?: boolean;
  customerSelectedLabel?: string | null;
  contractorSelectedLabel?: string | null;
  autoFocusPropertyName?: boolean;
}) {
  return (
    <fieldset className="space-y-6" disabled={disabled}>
      <Section
        title="Property"
        headerAction={<SwitchField<PropertyFormValues> name="isActive" label="Active" />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField<PropertyFormValues>
            name="propertyName"
            label="Property name"
            required
            autoFocus={autoFocusPropertyName}
            maxLength={NAME_MAX_LENGTH}
          />
          <SearchableSelectField<PropertyFormValues>
            name="contractorId"
            label="Contractor"
            placeholder="Select contractor"
            searchPlaceholder="Search contractors…"
            queryKey={["users", "contractors", "dropdown"]}
            selectedLabel={contractorSelectedLabel}
            fetchOptions={fetchContractorOptions}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchableSelectField<PropertyFormValues>
            name="customerId"
            label="Customer"
            placeholder="Select customer"
            searchPlaceholder="Search customers…"
            queryKey={["users", "customers", "dropdown"]}
            selectedLabel={customerSelectedLabel}
            fetchOptions={fetchCustomerOptions}
          />
        </div>
        <TextareaField<PropertyFormValues>
          name="accessNotes"
          label="Access notes"
          rows={3}
          maxLength={DESCRIPTION_MAX_LENGTH}
        />
      </Section>

      <Section title="Contact & address">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
  children,
}: {
  title: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card-elevated space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display font-semibold">{title}</h3>
        {headerAction}
      </div>
      {children}
    </div>
  );
}
