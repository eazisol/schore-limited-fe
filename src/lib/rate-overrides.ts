import { z } from "zod";

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
