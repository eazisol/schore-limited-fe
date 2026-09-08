import { Plus, Trash2 } from "lucide-react";
import {
  useFieldArray,
  type FieldArrayPath,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelectField, TextField } from "@/components/form";
import type { ApiJobTypeTemplateItem, JobTypeTemplateItemPayload } from "@/lib/api/services/job-types";
import { fetchPackageOptions, fetchProductOptions } from "@/lib/task-dropdowns";

export const jobTypeTemplateItemSchema = z
  .object({
    id: z.string().optional(),
    dayOffset: z.coerce.number().int().min(1).max(365),
    orderBy: z.coerce.number().int().min(0),
    itemKind: z.enum(["package", "addon"]),
    tradeGroupId: z.string().optional(),
    tradeGroupLabel: z.string().optional(),
    productId: z.string().optional(),
    productLabel: z.string().optional(),
    quantity: z.coerce.number().positive(),
    notes: z.string().optional(),
  })
  .superRefine((line, ctx) => {
    if (line.itemKind === "package" && !line.tradeGroupId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Package is required",
        path: ["tradeGroupId"],
      });
    }
    if (line.itemKind === "addon" && !line.productId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add-on is required",
        path: ["productId"],
      });
    }
  });

export type JobTypeTemplateLineValues = z.infer<typeof jobTypeTemplateItemSchema>;

export function emptyTemplateLine(index: number): JobTypeTemplateLineValues {
  return {
    dayOffset: index + 1,
    orderBy: index,
    itemKind: "package",
    tradeGroupId: "",
    tradeGroupLabel: "",
    productId: "",
    productLabel: "",
    quantity: 1,
    notes: "",
  };
}

export function mapApiTemplateItems(
  items: ApiJobTypeTemplateItem[] | null | undefined,
): JobTypeTemplateLineValues[] {
  return (items ?? []).map((line, index) => ({
    id: line.id,
    dayOffset: line.dayOffset,
    orderBy: line.orderBy ?? index,
    itemKind: line.tradeGroupId ? "package" : "addon",
    tradeGroupId: line.tradeGroupId ?? "",
    tradeGroupLabel: line.tradeGroupName ?? "",
    productId: line.productId ?? "",
    productLabel: line.productName ?? "",
    quantity: line.quantity || 1,
    notes: line.notes ?? "",
  }));
}

export function toTemplateItemPayload(
  lines: JobTypeTemplateLineValues[],
): JobTypeTemplateItemPayload[] {
  return lines.map((line, index) => ({
    id: line.id || null,
    dayOffset: line.dayOffset,
    orderBy: line.orderBy ?? index,
    tradeGroupId: line.itemKind === "package" ? line.tradeGroupId || null : null,
    productId: line.itemKind === "addon" ? line.productId || null : null,
    quantity: line.quantity,
    notes: line.notes?.trim() || null,
  }));
}

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  isView?: boolean;
};

export function JobTypeTemplateSequenceFields<T extends FieldValues>({
  form,
  isView = false,
}: Props<T>) {
  const name = "templateItems" as FieldArrayPath<T>;
  const { fields, append, remove } = useFieldArray({ control: form.control, name });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Template sequence</div>
          <p className="text-xs text-muted-foreground">
            Day 1 = start date. Add packages or add-ons in work order.
          </p>
        </div>
        {!isView ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append(emptyTemplateLine(fields.length) as never)}
          >
            <Plus className="h-4 w-4" /> Add line
          </Button>
        ) : null}
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No template lines yet.</p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const kindPath = `templateItems.${index}.itemKind` as Path<T>;
            const tradePath = `templateItems.${index}.tradeGroupId` as Path<T>;
            const tradeLabelPath = `templateItems.${index}.tradeGroupLabel` as Path<T>;
            const productPath = `templateItems.${index}.productId` as Path<T>;
            const productLabelPath = `templateItems.${index}.productLabel` as Path<T>;
            const itemKind = (form.watch(kindPath) as "package" | "addon" | undefined) ?? "package";
            const tradeLabel = (form.watch(tradeLabelPath) as string | undefined) ?? "";
            const productLabel = (form.watch(productLabelPath) as string | undefined) ?? "";

            return (
              <div
                key={field.id}
                className="grid grid-cols-1 items-end gap-x-2 gap-y-2 rounded border p-2.5 sm:grid-cols-[4.25rem_7.25rem_minmax(0,1fr)_4.25rem_2rem]"
              >
                <TextField
                  name={`templateItems.${index}.dayOffset` as Path<T>}
                  label="Day"
                  type="number"
                  className="min-w-0"
                />
                <div className="min-w-0 space-y-1">
                  <Label>Type</Label>
                  <select
                    className="flex h-9 w-full items-center rounded-md border border-input bg-card px-3 text-sm shadow-none"
                    disabled={isView}
                    value={itemKind}
                    onChange={(e) => {
                      const next = e.target.value as "package" | "addon";
                      form.setValue(kindPath, next as never, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      form.setValue(tradePath, "" as never, { shouldDirty: true });
                      form.setValue(tradeLabelPath, "" as never, { shouldDirty: true });
                      form.setValue(productPath, "" as never, { shouldDirty: true });
                      form.setValue(productLabelPath, "" as never, { shouldDirty: true });
                    }}
                  >
                    <option value="package">Package</option>
                    <option value="addon">Add-on</option>
                  </select>
                </div>
                {itemKind === "addon" ? (
                  <SearchableSelectField
                    name={productPath}
                    label="Add-on"
                    required
                    placeholder="Select add-on"
                    searchPlaceholder="Search add-ons…"
                    queryKey={["lookups", "products", "job-type-template", index]}
                    fetchOptions={fetchProductOptions}
                    selectedLabel={productLabel || null}
                    disabled={isView}
                    className="min-w-0"
                    onSelect={(option) =>
                      form.setValue(productLabelPath, option.label as never, {
                        shouldDirty: true,
                      })
                    }
                  />
                ) : (
                  <SearchableSelectField
                    name={tradePath}
                    label="Package"
                    required
                    placeholder="Select package"
                    searchPlaceholder="Search packages…"
                    queryKey={["lookups", "trade-groups", "job-type-template", index]}
                    fetchOptions={fetchPackageOptions}
                    selectedLabel={tradeLabel || null}
                    disabled={isView}
                    className="min-w-0"
                    onSelect={(option) =>
                      form.setValue(tradeLabelPath, option.label as never, {
                        shouldDirty: true,
                      })
                    }
                  />
                )}
                <TextField
                  name={`templateItems.${index}.quantity` as Path<T>}
                  label="Qty"
                  type="number"
                  className="min-w-0"
                />
                {!isView ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-8 shrink-0 text-destructive"
                    onClick={() => remove(index)}
                    aria-label={`Remove template line ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="h-9" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
