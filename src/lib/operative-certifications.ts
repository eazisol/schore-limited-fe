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
  documentNumber: string;
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
  documentNumber?: string | null;
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
  certificationTypeCode?: string | null;
  certificationLevelId?: string | null;
  certificationLevelName?: string | null;
  documentNumber?: string | null;
  startDate: string;
  expiryDate: string;
  notes?: string | null;
  files?: ApiOperativeCertificationFile[];
};

export type CertificationExpiryStatus = "Valid" | "Expiring soon" | "Expired";

/** Days before expiry that count as “Expiring soon” (matches backend reminder window). */
export const CERTIFICATION_EXPIRING_SOON_DAYS = 30;

/** Warn when assigning an operative if a cert expires on/before work date + this many days. */
export const CERTIFICATION_ASSIGN_WARN_DAYS = 7;

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
    documentNumber: "",
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
  documentNumber: z.string(),
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

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Derive display status from expiry date (client-side). */
export function certificationStatusFromExpiry(
  expiryDate: string | null | undefined,
  now: Date = startOfToday(),
): CertificationExpiryStatus | null {
  const expiry = parseDate((expiryDate ?? "").toString().slice(0, 10));
  if (!expiry) return null;
  const days = Math.round((expiry.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "Expired";
  if (days <= CERTIFICATION_EXPIRING_SOON_DAYS) return "Expiring soon";
  return "Valid";
}

/** e.g. "08 Sep 2024" */
export function formatCertificationDisplayDate(value: string | null | undefined): string {
  const raw = (value ?? "").toString().trim().slice(0, 10);
  if (!raw) return "—";
  const d = parseDate(raw);
  if (!d) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type CertificationAssignWarning = {
  name: string;
  expiryDate: string;
  displayExpiry: string;
};

/**
 * Certs that are already expired relative to a work date, or expire within
 * {@link CERTIFICATION_ASSIGN_WARN_DAYS} days of that work date.
 */
export function findCertificationWarningsForWorkDates(
  certifications: Array<{
    certificationTypeName?: string | null;
    certificationTypeCode?: string | null;
    expiryDate?: string | null;
  }>,
  workDates: Array<string | null | undefined>,
): CertificationAssignWarning[] {
  const refs = workDates
    .map((d) => parseDate((d ?? "").toString().slice(0, 10)))
    .filter((d): d is Date => d != null);
  if (refs.length === 0) return [];

  const warnMs = CERTIFICATION_ASSIGN_WARN_DAYS * 86_400_000;
  const byExpiry = new Map<string, CertificationAssignWarning>();

  for (const cert of certifications) {
    const expiryRaw = (cert.expiryDate ?? "").toString().slice(0, 10);
    const expiry = parseDate(expiryRaw);
    if (!expiry) continue;

    const atRisk = refs.some((workDate) => expiry.getTime() - workDate.getTime() <= warnMs);
    if (!atRisk) continue;

    const name =
      cert.certificationTypeName?.trim() ||
      cert.certificationTypeCode?.trim() ||
      "Certificate";
    const key = `${name}|${expiryRaw}`;
    if (byExpiry.has(key)) continue;
    byExpiry.set(key, {
      name,
      expiryDate: expiryRaw,
      displayExpiry: formatCertificationDisplayDate(expiryRaw),
    });
  }

  return [...byExpiry.values()].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export type CertificationExpiryRelative = {
  text: string;
  tone: "warning" | "destructive" | "muted";
};

/** Relative line under expiry, e.g. "(in 5 days)", "(expired)". */
export function formatCertificationExpiryRelative(
  expiryDate: string | null | undefined,
  now: Date = startOfToday(),
): CertificationExpiryRelative | null {
  const expiry = parseDate((expiryDate ?? "").toString().slice(0, 10));
  if (!expiry) return null;
  const days = Math.round((expiry.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return { text: "(expired)", tone: "destructive" };
  if (days === 0) return { text: "(today)", tone: "warning" };
  if (days < 60) {
    return {
      text: `(in ${days} day${days === 1 ? "" : "s"})`,
      tone: days <= CERTIFICATION_EXPIRING_SOON_DAYS ? "warning" : "muted",
    };
  }
  const months = Math.max(1, Math.round(days / 30));
  return {
    text: `(in ${months} month${months === 1 ? "" : "s"})`,
    tone: "muted",
  };
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
    const isBlank =
      !typeId &&
      !start &&
      !expiry &&
      !row.certificationLevelId.trim() &&
      !row.documentNumber.trim();
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
        message: "Issue date is required",
      });
    }
    if (!expiry) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "expiryDate"],
        message: "Expiry date is required",
      });
    }
    if (row.documentNumber.trim().length > 100) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "documentNumber"],
        message: "Number must be 100 characters or fewer",
      });
    }
    const startDate = parseDate(start);
    const expiryDate = parseDate(expiry);
    if (start && !startDate) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "startDate"],
        message: "Enter a valid issue date (dd/mm/yyyy)",
      });
    }
    if (expiry && !expiryDate) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "expiryDate"],
        message: "Enter a valid expiry date (dd/mm/yyyy)",
      });
    }
    if (startDate && expiryDate && expiryDate < startDate) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "expiryDate"],
        message: "Expiry must be on or after issue date",
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
      documentNumber: row.documentNumber.trim() || null,
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
    documentNumber: row.documentNumber?.trim() || "",
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
      (row.clientKey && saved.find((c) => c.clientKey && c.clientKey === row.clientKey)?.id) ||
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
