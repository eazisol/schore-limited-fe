import { z } from "zod";
import type { ProductPayload } from "@/lib/api/services/products";
import { descriptionSchema, nameSchema } from "@/lib/field-validation";

/** Item catalogue image upload limits. */
export const ITEM_IMAGE_MAX_SIZE_KB = 10 * 1024; // 10 MB
export const ITEM_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "svg",
  "jfif",
] as const;
export const ITEM_IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "image/jfif",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".jfif",
].join(",");

export const itemFormSchema = z.object({
  name: nameSchema(),
  description: descriptionSchema(),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(50, "SKU must be 50 characters or fewer"),
  productTypeId: z.string().trim().min(1, "Product type is required"),
  categoryId: z.string().trim().min(1, "Category is required"),
  unitId: z.string().trim().min(1, "Unit is required"),
  salePrice: z.coerce.number().min(0, "Sale price must be 0 or greater"),
  costPrice: z.coerce.number().min(0, "Cost price must be 0 or greater"),
  /** Preview only — image binary is sent as FormData `Files`. */
  imageUrl: z.string(),
  isActive: z.boolean(),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const itemFormDefaults: ItemFormValues = {
  name: "",
  description: "",
  sku: "",
  productTypeId: "",
  categoryId: "",
  unitId: "",
  salePrice: 0,
  costPrice: 0,
  imageUrl: "",
  isActive: true,
};

export function toProductPayload(
  values: ItemFormValues,
  options?: { updateTradeGroupItemPrices?: boolean },
): ProductPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    sku: values.sku.trim(),
    productTypeId: values.productTypeId,
    categoryId: values.categoryId,
    unitId: values.unitId,
    salePrice: values.salePrice,
    costPrice: values.costPrice,
    quantity: 1,
    isActive: values.isActive,
    updateTradeGroupItemPrices: options?.updateTradeGroupItemPrices ?? false,
  };
}
