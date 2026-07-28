import { useFieldArray, useFormContext, type Path } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField, SearchableSelectField } from "@/components/form";
import {
  emptyTradeGroupItem,
  type TradeGroupFormValues,
} from "@/lib/trade-group-form";
import { DESCRIPTION_MAX_LENGTH } from "@/lib/field-validation";
import { fetchProductOptions } from "@/lib/product-dropdowns";

const NOTES_MAX_LENGTH = DESCRIPTION_MAX_LENGTH;

/**
 * Reusable editable items grid for Trade Group forms.
 * Rows: Product, Quantity, Notes, Remove — plus Add Row.
 */
export function TradeGroupItemsEditor({ disabled = false }: { disabled?: boolean }) {
  const { control, watch, setValue } = useFormContext<TradeGroupFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => append(emptyTradeGroupItem())}
        >
          <Plus className="h-4 w-4" />
          Add row
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Product</th>
              <th className="w-28 px-3 py-2.5 text-left font-medium">Quantity</th>
              <th className="px-3 py-2.5 text-left font-medium">Notes</th>
              <th className="w-14 px-2 py-2.5 text-center font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No items yet. Add a row to include products.
                </td>
              </tr>
            ) : (
              fields.map((field, index) => {
                const productName = watch(`items.${index}.productName`);
                return (
                  <tr key={field.id} className="align-top">
                    <td className="px-3 py-2">
                      <SearchableSelectField<TradeGroupFormValues>
                        name={`items.${index}.productId` as Path<TradeGroupFormValues>}
                        required
                        placeholder="Select product"
                        searchPlaceholder="Search products…"
                        queryKey={["products", "dropdown"]}
                        selectedLabel={productName || null}
                        fetchOptions={fetchProductOptions}
                        disabled={disabled}
                        className="space-y-1"
                        onSelect={(option) => {
                          setValue(`items.${index}.productName`, option.label, {
                            shouldDirty: true,
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <TextField<TradeGroupFormValues>
                        name={`items.${index}.quantity` as Path<TradeGroupFormValues>}
                        required
                        type="number"
                        min={0.01}
                        step="any"
                        disabled={disabled}
                        className="space-y-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <TextField<TradeGroupFormValues>
                        name={`items.${index}.notes` as Path<TradeGroupFormValues>}
                        maxLength={NOTES_MAX_LENGTH}
                        disabled={disabled}
                        className="space-y-1"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={disabled}
                        aria-label={`Remove item row ${index + 1}`}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
