import {
  CreatableSearchableSelectField,
  TextField,
  TextareaField,
} from "@/components/form";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCodeInput,
} from "@/lib/field-validation";
import type { SiteFormValues } from "@/lib/site-form";
import { RateOverrideFields } from "@/components/rates/RateOverrideFields";

type SiteFormFieldsProps = {
  disabled?: boolean;
  /** When true, client cannot be changed (e.g. hierarchy wizard). */
  lockCustomer?: boolean;
  customerSelectedLabel?: string | null;
};

export function SiteFormFields({
  disabled,
  lockCustomer,
  customerSelectedLabel,
}: SiteFormFieldsProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <CreatableSearchableSelectField<SiteFormValues>
          name="customerId"
          label="Client"
          required
          placeholder="Select client"
          searchPlaceholder="Search clients…"
          queryKey={["users", "customers", "dropdown", "site-form"]}
          selectedLabel={customerSelectedLabel}
          fetchOptions={fetchCustomerOptions}
          lookupType={lockCustomer ? undefined : "customer"}
          disabled={disabled || lockCustomer}
        />
        <TextField<SiteFormValues>
          name="name"
          label="Name"
          required
          maxLength={NAME_MAX_LENGTH}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <TextField<SiteFormValues>
          name="code"
          label="Code"
          required
          maxLength={CODE_MAX_LENGTH}
          transformValue={normalizeCodeInput}
          inputClassName="uppercase"
          disabled={disabled}
        />
        <TextField<SiteFormValues> name="address" label="Address" maxLength={500} disabled={disabled} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <TextField<SiteFormValues> name="city" label="City" maxLength={100} disabled={disabled} />
        <TextField<SiteFormValues> name="state" label="State" maxLength={100} disabled={disabled} />
        <TextField<SiteFormValues> name="country" label="Country" maxLength={100} disabled={disabled} />
        <TextField<SiteFormValues> name="zipCode" label="ZIP Code" maxLength={20} disabled={disabled} />
      </div>
      <TextareaField<SiteFormValues>
        name="description"
        label="Description"
        rows={2}
        maxLength={DESCRIPTION_MAX_LENGTH}
        disabled={disabled}
      />
      <RateOverrideFields
        disabled={disabled}
        title="Rate overrides"
        hint="Leave empty to use the client’s rates, or the catalogue if none. Within parent budget saves immediately; above needs reason + Rate approvals."
      />
    </div>
  );
}
