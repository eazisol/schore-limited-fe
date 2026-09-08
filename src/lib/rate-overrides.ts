import { z } from "zod";
import { productsService } from "@/lib/api/services/products";

export type RateOverrideFormValue = {
  productId: string;
  productLabel: string;
  rate: string;
  effectiveFrom: string;
};

export type RateOverridePayload = {
  productId: string;
  rate: number;
  effectiveFrom: string;
};

export type ApiRateOverride = {
  id?: string;
  productId: string;
  productName?: string | null;
  rate: number;
  effectiveFrom: string;
};

export function todayInputDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function emptyRateOverride(): RateOverrideFormValue {
  return {
    productId: "",
    productLabel: "",
    rate: "",
    effectiveFrom: todayInputDate(),
  };
}

export const rateOverrideRowSchema = z.object({
  productId: z.string(),
  productLabel: z.string(),
  rate: z.string(),
  effectiveFrom: z.string(),
});

export function refineRateOverrides(
  rows: RateOverrideFormValue[],
  ctx: z.RefinementCtx,
  path = ["rateOverrides"],
) {
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const productId = row.productId.trim();
    if (!productId) return;
    if (seen.has(productId)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "productId"],
        message: "This item is already listed",
      });
    }
    seen.add(productId);
    if (!/^\d+(\.\d{1,2})?$/.test(row.rate.trim())) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "rate"],
        message: "Enter a valid amount (up to 2 decimal places)",
      });
    }
    if (!row.effectiveFrom.trim()) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "effectiveFrom"],
        message: "Effective from is required",
      });
    }
  });
}

export function toRateOverridePayload(rows: RateOverrideFormValue[]): RateOverridePayload[] {
  return rows
    .filter((row) => row.productId.trim())
    .map((row) => ({
      productId: row.productId,
      rate: Number(row.rate),
      effectiveFrom: row.effectiveFrom.trim() || todayInputDate(),
    }));
}

export function rateOverridesToFormValues(
  rows: ApiRateOverride[] | undefined,
): RateOverrideFormValue[] {
  return (rows ?? []).map((row) => ({
    productId: String(row.productId),
    productLabel: row.productName?.trim() || "",
    rate:
      row.rate != null && !Number.isNaN(Number(row.rate))
        ? String(row.rate)
        : "",
    effectiveFrom: String(row.effectiveFrom ?? "").slice(0, 10) || todayInputDate(),
  }));
}

/** Rows that are new or changed vs the last saved overrides (removals ignored). */
export function getChangedRateOverrides(
  current: RateOverridePayload[],
  baseline: RateOverridePayload[] = [],
): RateOverridePayload[] {
  const baseMap = new Map(baseline.map((row) => [row.productId, row]));
  return current.filter((row) => {
    const prev = baseMap.get(row.productId);
    if (!prev) return true;
    return prev.rate !== row.rate || prev.effectiveFrom !== row.effectiveFrom;
  });
}

/** True when any set rate is above that product's catalogue sale price. */
export async function hasRatesExceedingCatalogueCap(
  rows: RateOverridePayload[],
): Promise<boolean> {
  const unique = [...new Map(rows.map((row) => [row.productId, row])).values()];
  if (unique.length === 0) return false;

  const results = await Promise.all(
    unique.map(async (row) => {
      try {
        const res = await productsService.get(row.productId);
        const cap = Number(res.data?.salePrice ?? 0);
        return Number.isFinite(row.rate) && row.rate > cap;
      } catch {
        return false;
      }
    }),
  );
  return results.some(Boolean);
}
