import { useCallback, useRef, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelectField, TextField } from "@/components/form";
import { cn } from "@/lib/utils";
import { fetchProductOptions } from "@/lib/task-dropdowns";
import {
  emptyRateOverride,
  getCatalogueCap,
  type RateOverrideFormValue,
} from "@/lib/rate-overrides";
import { usePermissions } from "@/contexts/PermissionContext";
import { CAPABILITY_CODES } from "@/lib/access";
import {
  RateCapReasonModal,
  type RateCapReasonContext,
} from "@/components/rates/RateCapReasonModal";

type RateOverrideForm = {
  rateOverrides: RateOverrideFormValue[];
  rateChangeReason?: string;
};

type CapPrompt = RateCapReasonContext & {
  index: number;
  previousRate: string;
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
  void enforceCatalogueCap;
  const { hasCapability } = usePermissions();
  const canSee =
    hasCapability(CAPABILITY_CODES.seeRates) || hasCapability(CAPABILITY_CODES.editTaskPrices);
  const canEdit = hasCapability(CAPABILITY_CODES.editTaskPrices);
  const form = useFormContext<RateOverrideForm>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rateOverrides",
  });
  const [capPrompt, setCapPrompt] = useState<CapPrompt | null>(null);
  const checkingRef = useRef(false);
  const rateBeforeEditRef = useRef<Record<number, string>>({});

  const locked = disabled || !canEdit;

  const promptIfAboveCap = useCallback(
    async (index: number) => {
      if (locked || checkingRef.current || capPrompt) return;

      const productId = form.getValues(`rateOverrides.${index}.productId`)?.trim() ?? "";
      const rateRaw = form.getValues(`rateOverrides.${index}.rate`)?.trim() ?? "";
      const reason = form.getValues(`rateOverrides.${index}.reason`)?.trim() ?? "";
      const productLabel =
        form.getValues(`rateOverrides.${index}.productLabel`)?.trim() || "Item";

      if (!productId || !rateRaw) return;
      const rate = Number(rateRaw);
      if (!Number.isFinite(rate) || rate < 0) return;

      checkingRef.current = true;
      try {
        const cap = await getCatalogueCap(productId);
        if (cap == null) return;

        if (rate > cap) {
          if (reason) return;
          setCapPrompt({
            index,
            productName: productLabel,
            rate,
            cap,
            previousRate: rateBeforeEditRef.current[index] ?? "",
          });
          return;
        }

        if (reason) {
          form.setValue(`rateOverrides.${index}.reason`, "", { shouldDirty: true });
        }
      } finally {
        checkingRef.current = false;
      }
    },
    [capPrompt, form, locked],
  );

  if (!canSee) {
    return null;
  }

  const defaultHint =
    "Rates within the parent budget save immediately. Above the parent cap needs a per-item reason and Rate approvals.";

  function confirmCapReason(reason: string) {
    if (!capPrompt) return;
    form.setValue(`rateOverrides.${capPrompt.index}.reason`, reason, {
      shouldDirty: true,
      shouldTouch: true,
    });
    rateBeforeEditRef.current[capPrompt.index] = form.getValues(
      `rateOverrides.${capPrompt.index}.rate`,
    );
    setCapPrompt(null);
  }

  function cancelCapReason() {
    if (!capPrompt) return;
    form.setValue(`rateOverrides.${capPrompt.index}.rate`, capPrompt.previousRate, {
      shouldDirty: true,
      shouldTouch: true,
    });
    form.setValue(`rateOverrides.${capPrompt.index}.reason`, "", { shouldDirty: true });
    setCapPrompt(null);
  }

  return (
    <div className="min-w-0 space-y-2">
      {title ? <h3 className="font-display text-sm font-semibold">{title}</h3> : null}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{defaultHint}</p>
      )}
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">No overrides. Standard / parent rates apply.</p>
      ) : (
        <div className="min-w-0 space-y-2">
          {fields.map((field, index) => {
            const rowReason = form.watch(`rateOverrides.${index}.reason`);
            return (
              <div key={field.id} className="min-w-0 space-y-1">
                <div className="grid min-w-0 grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(5.5rem,7.5rem)_minmax(0,9rem)_auto]">
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
                      form.setValue(`rateOverrides.${index}.reason`, "", { shouldDirty: true });
                      void promptIfAboveCap(index);
                    }}
                    disabled={locked}
                  />
                  <TextField<RateOverrideForm>
                    name={`rateOverrides.${index}.rate`}
                    label={index === 0 ? "Rate" : undefined}
                    placeholder="0.00"
                    disabled={locked}
                    className="min-w-0"
                    inputClassName="h-9 min-w-0"
                    leftIcon={({ className }) => (
                      <span className={cn(className, "text-sm font-semibold leading-none")}>£</span>
                    )}
                    onFocus={() => {
                      rateBeforeEditRef.current[index] =
                        form.getValues(`rateOverrides.${index}.rate`) ?? "";
                    }}
                    onChange={() => {
                      form.setValue(`rateOverrides.${index}.reason`, "", { shouldDirty: true });
                    }}
                    onBlur={() => {
                      void promptIfAboveCap(index);
                    }}
                  />
                  <TextField<RateOverrideForm>
                    name={`rateOverrides.${index}.effectiveFrom`}
                    label={index === 0 ? "Effective from" : undefined}
                    type="date"
                    disabled={locked}
                    className="min-w-0"
                    inputClassName="h-9 min-w-0"
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
                {rowReason?.trim() ? (
                  <p className="truncate text-[11px] text-muted-foreground" title={rowReason}>
                    Cap reason: {rowReason}
                  </p>
                ) : null}
              </div>
            );
          })}
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

      <RateCapReasonModal
        open={Boolean(capPrompt)}
        context={capPrompt}
        onCancel={cancelCapReason}
        onConfirm={confirmCapReason}
      />
    </div>
  );
}
