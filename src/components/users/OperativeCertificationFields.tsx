import { useEffect, useMemo, useRef } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { FileUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextField, CreatableSearchableSelectField } from "@/components/form";
import type { SearchableSelectOption } from "@/components/form";
import { FormFieldHint } from "@/components/form/FormFieldLabel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  certificationStatusFromExpiry,
  emptyCertification,
  type CertificationFormValue,
} from "@/lib/operative-certifications";
import { certificationTypesService } from "@/lib/api/services/certification-types";
import { certificationLevelsService } from "@/lib/api/services/certification-levels";
import { DROPDOWN_FETCH_SIZE } from "@/lib/dropdown-fetch";
import { resolveProfileImageUrl } from "@/lib/api/services/users";

type CertificationForm = {
  certifications: CertificationFormValue[];
};

const ACCEPTED_FILES = ".pdf,.jpg,.jpeg,.png,.webp";

async function fetchTypeOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await certificationTypesService.list({
    page: 1,
    pageSize: DROPDOWN_FETCH_SIZE,
    search,
  });
  return (res.data.items ?? [])
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      value: String(row.id),
      label: row.name?.trim() || `Type ${row.id}`,
    }));
}

function makeLevelFetcher(typeId: string) {
  return async (search: string): Promise<SearchableSelectOption[]> => {
    if (!typeId) return [];
    const res = await certificationLevelsService.list({
      page: 1,
      pageSize: DROPDOWN_FETCH_SIZE,
      search,
      certificationTypeId: typeId,
    });
    return (res.data.items ?? [])
      .filter((row) => row.isActive !== false)
      .map((row) => ({
        value: String(row.id),
        label: row.name?.trim() || `Level ${row.id}`,
      }));
  };
}

function CertificationRow({ index, locked }: { index: number; locked: boolean }) {
  const form = useFormContext<CertificationForm>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typeId = useWatch({
    control: form.control,
    name: `certifications.${index}.certificationTypeId`,
  });
  const typeLabel = useWatch({
    control: form.control,
    name: `certifications.${index}.certificationTypeLabel`,
  });
  const levelLabel = useWatch({
    control: form.control,
    name: `certifications.${index}.certificationLevelLabel`,
  });
  const expiryDate = useWatch({
    control: form.control,
    name: `certifications.${index}.expiryDate`,
  });
  const existingFiles = useWatch({
    control: form.control,
    name: `certifications.${index}.existingFiles`,
  });
  const pendingFiles = useWatch({
    control: form.control,
    name: `certifications.${index}.pendingFiles`,
  });
  const removedFileIds = useWatch({
    control: form.control,
    name: `certifications.${index}.removedFileIds`,
  });

  const expiryStatus = useMemo(() => certificationStatusFromExpiry(expiryDate), [expiryDate]);

  const levelFetcher = useMemo(() => makeLevelFetcher(typeId?.trim() || ""), [typeId]);
  const levelsQuery = useMemo(
    () => ["lookups", "certification-levels", typeId || "none"] as const,
    [typeId],
  );

  const visibleExisting = (existingFiles ?? []).filter(
    (f) => !(removedFileIds ?? []).includes(f.id),
  );

  useEffect(() => {
    let cancelled = false;
    async function syncLevelRequirement() {
      const id = typeId?.trim();
      if (!id) return;
      const res = await certificationLevelsService.list({
        page: 1,
        pageSize: 1,
        certificationTypeId: id,
      });
      if (cancelled) return;
      const hasLevels = (res.data.totalCount ?? 0) > 0;
      if (!hasLevels) {
        form.setValue(`certifications.${index}.certificationLevelId`, "", { shouldDirty: true });
        form.setValue(`certifications.${index}.certificationLevelLabel`, "", { shouldDirty: true });
      }
    }
    void syncLevelRequirement();
    return () => {
      cancelled = true;
    };
  }, [typeId, index, form]);

  function addPendingFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...(pendingFiles ?? []), ...Array.from(list)];
    form.setValue(`certifications.${index}.pendingFiles`, next, { shouldDirty: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePending(fileIndex: number) {
    const next = (pendingFiles ?? []).filter((_, i) => i !== fileIndex);
    form.setValue(`certifications.${index}.pendingFiles`, next, { shouldDirty: true });
  }

  function removeExisting(fileId: string) {
    const nextRemoved = [...new Set([...(removedFileIds ?? []), fileId])];
    form.setValue(`certifications.${index}.removedFileIds`, nextRemoved, { shouldDirty: true });
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <CreatableSearchableSelectField<CertificationForm>
          name={`certifications.${index}.certificationTypeId`}
          label="Certification type"
          required
          placeholder="Select type"
          searchPlaceholder="Search types…"
          queryKey={["lookups", "certification-types"]}
          fetchOptions={fetchTypeOptions}
          selectedLabel={typeLabel || undefined}
          lookupType="certificationType"
          onSelect={(option) => {
            form.setValue(`certifications.${index}.certificationTypeLabel`, option.label, {
              shouldDirty: true,
            });
            form.setValue(`certifications.${index}.certificationLevelId`, "", {
              shouldDirty: true,
            });
            form.setValue(`certifications.${index}.certificationLevelLabel`, "", {
              shouldDirty: true,
            });
          }}
          disabled={locked}
        />
        <CreatableSearchableSelectField<CertificationForm>
          name={`certifications.${index}.certificationLevelId`}
          label="Certification level"
          placeholder={typeId ? "Select level (if applicable)" : "Select type first"}
          searchPlaceholder="Search levels…"
          queryKey={levelsQuery}
          fetchOptions={levelFetcher}
          selectedLabel={levelLabel || undefined}
          lookupType="certificationLevel"
          canCreate={typeId?.trim() ? undefined : false}
          lookupContext={{
            certificationTypeId: typeId?.trim() || undefined,
            certificationTypeLabel: typeLabel || undefined,
          }}
          onSelect={(option) => {
            form.setValue(`certifications.${index}.certificationLevelLabel`, option.label, {
              shouldDirty: true,
            });
          }}
          disabled={locked || !typeId}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <TextField<CertificationForm>
          name={`certifications.${index}.documentNumber`}
          label="Number"
          placeholder="e.g. card / cert ID"
          maxLength={100}
          disabled={locked}
        />
        <TextField<CertificationForm>
          name={`certifications.${index}.startDate`}
          label="Issue date"
          type="date"
          required
          lang="en-GB"
          disabled={locked}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <TextField<CertificationForm>
          name={`certifications.${index}.expiryDate`}
          label="Expiry date"
          type="date"
          required
          lang="en-GB"
          placeholder="dd/mm/yyyy"
          disabled={locked}
        />
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label>Status</Label>
            <FormFieldHint description="Valid until the expiry date; Invalid after it." />
          </div>
          <div className="flex h-9 items-center">
            {expiryStatus ? (
              <StatusBadge status={expiryStatus} />
            ) : (
              <span className="text-sm text-muted-foreground">Set expiry date</span>
            )}
          </div>
        </div>
      </div>
      <TextField<CertificationForm>
        name={`certifications.${index}.notes`}
        label="Notes"
        placeholder="Optional"
        disabled={locked}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Attachments</p>
          {!locked ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILES}
                multiple
                className="sr-only"
                onChange={(e) => addPendingFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-4 w-4" />
                Add files
              </Button>
            </>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          PDF, JPG, PNG or WEBP. Max 10 MB each. Multiple files allowed.
        </p>
        {visibleExisting.length === 0 && (pendingFiles?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">No files attached.</p>
        ) : (
          <ul className="space-y-1">
            {visibleExisting.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5 text-sm"
              >
                <a
                  href={resolveProfileImageUrl(file.filePath)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate text-info hover:underline"
                >
                  {file.fileName}
                </a>
                {!locked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive"
                    aria-label={`Remove ${file.fileName}`}
                    onClick={() => removeExisting(file.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
            {(pendingFiles ?? []).map((file, fileIndex) => (
              <li
                key={`pending-${file.name}-${file.size}-${fileIndex}`}
                className="flex items-center justify-between gap-2 rounded border border-dashed border-border px-2 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">{file.name} (pending)</span>
                {!locked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removePending(fileIndex)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function OperativeCertificationFields({ disabled = false }: { disabled?: boolean }) {
  const form = useFormContext<CertificationForm>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "certifications",
  });

  return (
    <div className="space-y-2">
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">No certifications recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <CertificationRow key={field.id} index={index} locked={disabled} />
          ))}
        </div>
      )}
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyCertification())}
          >
            <Plus className="h-4 w-4" />
            Add certification
          </Button>
          {fields.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => remove(fields.length - 1)}
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
