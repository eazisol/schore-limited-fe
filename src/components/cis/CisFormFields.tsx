import { TextField, TextareaField, SwitchField } from "@/components/form";
import type { CisFormValues } from "@/lib/cis-form";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCodeInput,
} from "@/lib/field-validation";

export function CisFormFields({ disabled = false }: { disabled?: boolean }) {
  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField<CisFormValues>
          name="name"
          label="Name"
          required
          autoFocus
          maxLength={NAME_MAX_LENGTH}
        />
        <TextField<CisFormValues>
          name="code"
          label="Code"
          required
          maxLength={CODE_MAX_LENGTH}
          transformValue={normalizeCodeInput}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField<CisFormValues>
          name="rate"
          label="Rate"
          required
          type="number"
          min={0}
          step="0.01"
        />
        <TextField<CisFormValues>
          name="orderBy"
          label="Order"
          required
          type="number"
          min={0}
          step="1"
        />
      </div>
      <TextareaField<CisFormValues>
        name="description"
        label="Description"
        rows={3}
        maxLength={DESCRIPTION_MAX_LENGTH}
      />
      <SwitchField<CisFormValues>
        name="isActive"
        label="Active"
        description="Status can be selected on operative records."
      />
    </fieldset>
  );
}
