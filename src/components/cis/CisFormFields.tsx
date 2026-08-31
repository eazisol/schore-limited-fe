import { TextField, TextareaField, SwitchField } from "@/components/form";
import type { CisFormValues } from "@/lib/cis-form";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCodeInput,
} from "@/lib/field-validation";

export function CisFormFields({
  disabled = false,
  showHeader = true,
}: {
  disabled?: boolean;
  showHeader?: boolean;
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      {showHeader ? (
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display font-semibold">CIS status</h3>
          <SwitchField<CisFormValues> name="isActive" label="Active" />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<CisFormValues> name="name" label="Name" required maxLength={NAME_MAX_LENGTH} />
        <TextField<CisFormValues>
          name="code"
          label="Code"
          required
          maxLength={CODE_MAX_LENGTH}
          transformValue={normalizeCodeInput}
        />
        <TextField<CisFormValues>
          name="rate"
          label="Rate"
          required
          type="number"
          min={0}
          step="0.01"
        />
        <TextareaField<CisFormValues>
          name="description"
          label="Description"
          rows={3}
          maxLength={DESCRIPTION_MAX_LENGTH}
          className="sm:col-span-2"
        />
      </div>
    </fieldset>
  );
}
