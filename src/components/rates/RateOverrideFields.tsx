import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelectField, TextField } from "@/components/form";
import { cn } from "@/lib/utils";
import { fetchProductOptions } from "@/lib/task-dropdowns";
import { emptyRateOverride, type RateOverrideFormValue } from "@/lib/rate-overrides";
import { usePermissions } from "@/contexts/PermissionContext";
import { CAPABILITY_CODES } from "@/lib/access";

type RateOverrideForm = {
  rateOverrides: RateOverrideFormValue[];
  rateChangeReason?: string;
};

export function RateOverrideFields({
  disabled = false,
  title,
  hint,
  enforceCatalogueCap = false,
}: {
  disabled?: boolean;
  title?: string;
  hint?: string;
  /** @deprecated Cap applies on all scopes via parent waterfall; kept for call-site compatibility. */
  enforceCatalogueCap?: boolean;
}) {
  const { hasCapability } = usePermissions();
  const canSee = hasCapability(CAPABILITY_CODES.seeRates) || hasCapability(CAPABILITY_CODES.editTaskPrices);
  const canEdit = hasCapability(CAPABILITY_CODES.editTaskPrices);
  const form = useFormContext<RateOverrideForm>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rateOverrides",
  });

  if (!canSee) {
    return null;
  }

  const locked = disabled || !canEdit;
  const defaultHint =
    "Rates within the parent budget save immediately. Above the parent cap needs a reason and Rate approvals.";

  return (
    <div className="space-y-2">
      {title ? <h3 className="font-display text-sm font-semibold">{title}</h3> : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : (
        <p className="text-xs text-muted-foreground">{defaultHint}</p>
      )}
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">No overrides. Standard / parent rates apply.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1.4fr)_7rem_9rem_auto]"
            >
              <SearchableSelectField<RateOverrideForm>
                name={`rateOverrides.${index}.productId`}
                label={index === 0 ? "Task item" : undefined}
                placeholder="Select item"
                searchPlaceholder="Search items…"
                queryKey={["products", "rate-overrides"]}
                fetchOptions={fetchProductOptions}
                selectedLabel={form.watch(`rateOverrides.${index}.productLabel`) || undefined}
                onSelect={(option) => {
                  form.setValue(`rateOverrides.${index}.productLabel`, option.label, {
                    shouldDirty: true,
                  });
                }}
                disabled={locked}
              />
              <TextField<RateOverrideForm>
                name={`rateOverrides.${index}.rate`}
                label={index === 0 ? "Rate" : undefined}
                placeholder="0.00"
                disabled={locked}
                inputClassName="h-9"
                leftIcon={({ className }) => (
                  <span className={cn(className, "text-sm font-semibold leading-none")}>£</span>
                )}
              />
              <TextField<RateOverrideForm>
                name={`rateOverrides.${index}.effectiveFrom`}
                label={index === 0 ? "Effective from" : undefined}
                type="date"
                disabled={locked}
                inputClassName="h-9"
              />
              {!locked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                  aria-label="Remove override"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <span className="h-9 w-9" />
              )}
            </div>
          ))}
        </div>
      )}
      {!locked ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => append(emptyRateOverride())}
        >
          <Plus className="h-3.5 w-3.5" />
          Add override
        </Button>
      ) : null}
    </div>
  );
}
