import { TextField, TextareaField, SwitchField } from "@/components/form";
import type { TradeFormValues } from "@/lib/trade-form";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCodeInput,
} from "@/lib/field-validation";

export function TradeFormFields({ disabled = false }: { disabled?: boolean }) {
  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField<TradeFormValues>
          name="name"
          label="Name"
          required
          autoFocus
          maxLength={NAME_MAX_LENGTH}
        />
        <TextField<TradeFormValues>
          name="code"
          label="Code"
          required
          maxLength={CODE_MAX_LENGTH}
          transformValue={normalizeCodeInput}
        />
      </div>
      <TextareaField<TradeFormValues>
        name="description"
        label="Description"
        rows={3}
        maxLength={DESCRIPTION_MAX_LENGTH}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SwitchField<TradeFormValues>
          name="isActive"
          label="Active"
        />
      </div>
    </fieldset>
  );
}
