import {
  TextField,
  SwitchField,
  CreatableSearchableSelectField,
} from "@/components/form";
import type { TradeGroupFormValues } from "@/lib/trade-group-form";
import {
  CODE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCodeInput,
} from "@/lib/field-validation";
import { fetchTradeOptions } from "@/lib/user-dropdowns";

export function TradeGroupFormFields({
  disabled = false,
  embedded = false,
  tradeSelectedLabel,
  autoFocusName = false,
}: {
  disabled?: boolean;
  embedded?: boolean;
  tradeSelectedLabel?: string | null;
  autoFocusName?: boolean;
}) {
  const fields = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
      <CreatableSearchableSelectField<TradeGroupFormValues>
        name="tradeId"
        label="Trade"
        required
        placeholder="Select trade"
        searchPlaceholder="Search trades…"
        queryKey={["lookups", "trades"]}
        selectedLabel={tradeSelectedLabel}
        fetchOptions={fetchTradeOptions}
        lookupType="trade"
      />
      <TextField<TradeGroupFormValues>
        name="name"
        label="Name"
        required
        autoFocus={autoFocusName}
        maxLength={NAME_MAX_LENGTH}
      />
      <TextField<TradeGroupFormValues>
        name="code"
        label="Code"
        required
        maxLength={CODE_MAX_LENGTH}
        transformValue={normalizeCodeInput}
      />
    </div>
  );

  if (embedded) {
    return (
      <fieldset className="space-y-3" disabled={disabled}>
        {fields}
      </fieldset>
    );
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <div className="card-elevated space-y-3 p-4 sm:p-6">
        <div className="flex items-center justify-end gap-4">
          <SwitchField<TradeGroupFormValues> name="isActive" label="Active" />
        </div>
        {fields}
      </div>
    </fieldset>
  );
}
