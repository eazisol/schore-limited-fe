import {
  TextField,
  TextareaField,
  CheckboxField,
  SearchableSelectField,
  ImageUploadField,
} from "@/components/form";
import { productLookupsService } from "@/lib/api/services/product-lookups";
import type { ItemFormValues } from "@/lib/item-form";
import type { SearchableSelectOption } from "@/components/form";

async function mapLookupOptions(
  fetcher: typeof productLookupsService.categories,
  search: string,
): Promise<SearchableSelectOption[]> {
  const res = await fetcher({ page: 1, pageSize: 20, search });
  return (res.data.items ?? [])
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || `Option ${row.id}`,
    }));
}

export function ItemFormFields({
  selectedLabels,
  onImageFileChange,
}: {
  /** Labels for pre-selected IDs on edit (names from the Products API). */
  selectedLabels?: {
    productType?: string | null;
    category?: string | null;
    unit?: string | null;
  };
  /** Binary file for FormData `Files` (preview stays in `imageUrl`). */
  onImageFileChange?: (file: File | null) => void;
}) {
  return (
    <>
      <ImageUploadField<ItemFormValues>
        name="imageUrl"
        label="Image"
        onFileChange={onImageFileChange}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField<ItemFormValues> name="name" label="Name" required autoFocus maxLength={100} />
        <TextField<ItemFormValues> name="sku" label="SKU" required maxLength={50} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SearchableSelectField<ItemFormValues>
          name="productTypeId"
          label="Product type"
          required
          placeholder="Select product type"
          searchPlaceholder="Search product types…"
          queryKey={["lookups", "product-types"]}
          selectedLabel={selectedLabels?.productType}
          fetchOptions={(search) => mapLookupOptions(productLookupsService.productTypes, search)}
        />
        <SearchableSelectField<ItemFormValues>
          name="categoryId"
          label="Category"
          required
          placeholder="Select category"
          searchPlaceholder="Search categories…"
          queryKey={["lookups", "categories"]}
          selectedLabel={selectedLabels?.category}
          fetchOptions={(search) => mapLookupOptions(productLookupsService.categories, search)}
        />
        <SearchableSelectField<ItemFormValues>
          name="unitId"
          label="Unit"
          required
          placeholder="Select unit"
          searchPlaceholder="Search units…"
          queryKey={["lookups", "units"]}
          selectedLabel={selectedLabels?.unit}
          fetchOptions={(search) => mapLookupOptions(productLookupsService.units, search)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField<ItemFormValues>
          name="salePrice"
          label="Sale price"
          required
          type="number"
          min={0}
          step="0.01"
        />
        <TextField<ItemFormValues>
          name="costPrice"
          label="Cost price"
          required
          type="number"
          min={0}
          step="0.01"
        />
      </div>

      <CheckboxField<ItemFormValues>
        name="isActive"
        label="Active"
        description="Item can be selected across the platform."
      />

      <TextareaField<ItemFormValues>
        name="description"
        label="Description"
        rows={4}
        maxLength={500}
        className="md:col-span-full"
      />
    </>
  );
}
