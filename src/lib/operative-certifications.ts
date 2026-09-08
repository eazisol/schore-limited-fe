import { z } from "zod";

export type CertificationExistingFile = {
  id: string;
  fileName: string;
  filePath: string;
};

export type CertificationFormValue = {
  id: string;
  clientKey: string;
  certificationTypeId: string;
  certificationTypeLabel: string;
  certificationLevelId: string;
  certificationLevelLabel: string;
  startDate: string;
  expiryDate: string;
  notes: string;
  existingFiles: CertificationExistingFile[];
  removedFileIds: string[];
  /** Client-only pending uploads (not serialised in zod refine deeply). */
  pendingFiles: File[];
};

export type CertificationPayload = {
  id?: string | null;
  clientKey?: string | null;
  certificationTypeId: string;
  certificationLevelId?: string | null;
  startDate: string;
  expiryDate: string;
  notes?: string | null;
  removedFileIds?: string[] | null;
};

export type ApiOperativeCertificationFile = {
  id: string;
  fileName: string;
  filePath: string;
  contentType?: string | null;
  fileSizeBytes?: number;
};

export type ApiOperativeCertification = {
  id?: string;
  clientKey?: string | null;
  certificationTypeId: string;
  certificationTypeName?: string | null;
  certificationLevelId?: string | null;
  certificationLevelName?: string | null;
  startDate: string;
  expiryDate: string;
  notes?: string | null;
  files?: ApiOperativeCertificationFile[];
};

export function newClientKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ck-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyCertification(): CertificationFormValue {
  return {
    id: "",
    clientKey: newClientKey(),
    certificationTypeId: "",
    certificationTypeLabel: "",
    certificationLevelId: "",
    certificationLevelLabel: "",
    startDate: "",
    expiryDate: "",
    notes: "",
    existingFiles: [],
    removedFileIds: [],
    pendingFiles: [],
  };
}

export const certificationRowSchema = z.object({
  id: z.string(),
  clientKey: z.string(),
  certificationTypeId: z.string(),
  certificationTypeLabel: z.string(),
  certificationLevelId: z.string(),
  certificationLevelLabel: z.string(),
  startDate: z.string(),
  expiryDate: z.string(),
  notes: z.string(),
  existingFiles: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      filePath: z.string(),
    }),
  ),
  removedFileIds: z.array(z.string()),
  pendingFiles: z.array(z.any()),
});

function parseDate(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function refineCertifications(
  rows: CertificationFormValue[],
  ctx: z.RefinementCtx,
  path = ["certifications"],
) {
  rows.forEach((row, index) => {
    const typeId = row.certificationTypeId.trim();
    const start = row.startDate.trim();
    const expiry = row.expiryDate.trim();
    const isBlank = !typeId && !start && !expiry && !row.certificationLevelId.trim();
    if (isBlank) return;

    if (!typeId) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "certificationTypeId"],
        message: "Certification type is required",
      });
    }
    if (!start) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "startDate"],
        message: "Start date is required",
      });
    }
    if (!expiry) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "expiryDate"],
        message: "Expiry date is required",
      });
    }
    const startDate = parseDate(start);
    const expiryDate = parseDate(expiry);
    if (start && !startDate) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "startDate"],
        message: "Enter a valid start date",
      });
    }
    if (expiry && !expiryDate) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "expiryDate"],
        message: "Enter a valid expiry date",
      });
    }
    if (startDate && expiryDate && expiryDate < startDate) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "expiryDate"],
        message: "Expiry must be on or after start date",
      });
    }
  });
}

export function toCertificationPayload(rows: CertificationFormValue[]): CertificationPayload[] {
  return rows
    .filter((row) => row.certificationTypeId.trim())
    .map((row) => ({
      id: row.id.trim() || null,
      clientKey: row.clientKey.trim() || null,
      certificationTypeId: row.certificationTypeId.trim(),
      certificationLevelId: row.certificationLevelId.trim() || null,
      startDate: row.startDate.trim(),
      expiryDate: row.expiryDate.trim(),
      notes: row.notes.trim() || null,
      removedFileIds: row.removedFileIds.filter(Boolean),
    }));
}

export function certificationsToFormValues(
  rows: ApiOperativeCertification[] | undefined,
): CertificationFormValue[] {
  return (rows ?? []).map((row) => ({
    id: row.id != null ? String(row.id) : "",
    clientKey: row.clientKey?.trim() || newClientKey(),
    certificationTypeId: String(row.certificationTypeId ?? ""),
    certificationTypeLabel: row.certificationTypeName?.trim() || "",
    certificationLevelId: row.certificationLevelId != null ? String(row.certificationLevelId) : "",
    certificationLevelLabel: row.certificationLevelName?.trim() || "",
    startDate: (row.startDate ?? "").toString().slice(0, 10),
    expiryDate: (row.expiryDate ?? "").toString().slice(0, 10),
    notes: row.notes?.trim() || "",
    existingFiles: (row.files ?? []).map((f) => ({
      id: String(f.id),
      fileName: f.fileName,
      filePath: f.filePath,
    })),
    removedFileIds: [],
    pendingFiles: [],
  }));
}

/** Resolve saved certification IDs for pending file uploads after create/update. */
export function resolveCertificationIdsForUpload(
  formRows: CertificationFormValue[],
  savedCerts: ApiOperativeCertification[] | undefined,
): { certificationId: string; files: File[] }[] {
  const saved = savedCerts ?? [];
  const result: { certificationId: string; files: File[] }[] = [];

  for (const row of formRows.filter((r) => r.certificationTypeId.trim())) {
    if (!row.pendingFiles?.length) continue;

    let certId =
      (row.clientKey &&
        saved.find((c) => c.clientKey && c.clientKey === row.clientKey)?.id) ||
      (row.id && saved.find((c) => String(c.id) === row.id)?.id) ||
      null;

    if (!certId) {
      const match = saved.find(
        (c) =>
          String(c.certificationTypeId) === row.certificationTypeId &&
          (c.certificationLevelId != null ? String(c.certificationLevelId) : "") ===
            (row.certificationLevelId || "") &&
          String(c.startDate).slice(0, 10) === row.startDate &&
          String(c.expiryDate).slice(0, 10) === row.expiryDate,
      );
      certId = match?.id ?? null;
    }

    if (certId) {
      result.push({ certificationId: String(certId), files: row.pendingFiles });
    }
  }

  return result;
}
