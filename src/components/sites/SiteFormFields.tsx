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

type SiteFormFieldsProps = {
  disabled?: boolean;
  customerSelectedLabel?: string | null;
};

export function SiteFormFields({ disabled, customerSelectedLabel }: SiteFormFieldsProps) {
  return (
    <div className="space-y-3">
      <CreatableSearchableSelectField<SiteFormValues>
        name="customerId"
        label="Client"
        required
        placeholder="Select client"
        searchPlaceholder="Search clients…"
        queryKey={["users", "customers", "dropdown", "site-form"]}
        selectedLabel={customerSelectedLabel}
        fetchOptions={fetchCustomerOptions}
        lookupType="customer"
        disabled={disabled}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<SiteFormValues>
          name="name"
          label="Name"
          required
          maxLength={NAME_MAX_LENGTH}
          disabled={disabled}
        />
        <TextField<SiteFormValues>
          name="code"
          label="Code"
          required
          maxLength={CODE_MAX_LENGTH}
          transformValue={normalizeCodeInput}
          inputClassName="uppercase"
          disabled={disabled}
        />
      </div>
      <TextareaField<SiteFormValues>
        name="description"
        label="Description"
        rows={3}
        maxLength={DESCRIPTION_MAX_LENGTH}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField<SiteFormValues> name="address" label="Address" maxLength={500} disabled={disabled} />
        <TextField<SiteFormValues> name="city" label="City" maxLength={100} disabled={disabled} />
        <TextField<SiteFormValues> name="state" label="State" maxLength={100} disabled={disabled} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<SiteFormValues> name="country" label="Country" maxLength={100} disabled={disabled} />
        <TextField<SiteFormValues> name="zipCode" label="ZIP Code" maxLength={20} disabled={disabled} />
      </div>
    </div>
  );
}
