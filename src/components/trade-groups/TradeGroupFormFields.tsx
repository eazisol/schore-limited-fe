import type { ReactNode } from "react";
import {
  TextField,
  TextareaField,
  SwitchField,
  SearchableSelectField,
} from "@/components/form";
import type { TradeGroupFormValues } from "@/lib/trade-group-form";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCodeInput,
} from "@/lib/field-validation";
import { fetchTradeOptions } from "@/lib/product-dropdowns";
import { TradeGroupItemsEditor } from "@/components/trade-groups/TradeGroupItemsEditor";

export function TradeGroupFormFields({
  disabled = false,
  tradeSelectedLabel,
  autoFocusName = false,
}: {
  disabled?: boolean;
  tradeSelectedLabel?: string | null;
  autoFocusName?: boolean;
}) {
  return (
    <fieldset className="space-y-6" disabled={disabled}>
      <Section title="Trade group">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchableSelectField<TradeGroupFormValues>
            name="tradeId"
            label="Trade"
            required
            placeholder="Select trade"
            searchPlaceholder="Search trades…"
            queryKey={["trades", "dropdown"]}
            selectedLabel={tradeSelectedLabel}
            fetchOptions={fetchTradeOptions}
          />
          <TextField<TradeGroupFormValues>
            name="name"
            label="Name"
            required
            autoFocus={autoFocusName}
            maxLength={NAME_MAX_LENGTH}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField<TradeGroupFormValues>
            name="code"
            label="Code"
            required
            maxLength={CODE_MAX_LENGTH}
            transformValue={normalizeCodeInput}
          />
          <SwitchField<TradeGroupFormValues> name="isActive" label="Active" />
        </div>
        <TextareaField<TradeGroupFormValues>
          name="description"
          label="Description"
          rows={3}
          maxLength={DESCRIPTION_MAX_LENGTH}
        />
      </Section>

      <Section title="Items">
        <TradeGroupItemsEditor disabled={disabled} />
      </Section>
    </fieldset>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="card-elevated space-y-4 p-4 sm:p-6">
      <h3 className="font-display font-semibold">{title}</h3>
      {children}
    </div>
  );
}
