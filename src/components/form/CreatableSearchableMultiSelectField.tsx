import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FieldValues, Path } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import {
  SearchableMultiSelectField,
  type SearchableMultiSelectFieldProps,
  type SearchableSelectOption,
} from "./SearchableMultiSelectField";
import { useLookupCreatePermission } from "./useLookupCreatePermission";
import { LookupQuickCreateModal } from "@/components/lookups/LookupQuickCreateModal";
import { LOOKUP_CREATE_CONFIG, type LookupCreateContext, type LookupCreateType } from "@/lib/lookup-create";

export interface CreatableSearchableMultiSelectFieldProps<T extends FieldValues>
  extends SearchableMultiSelectFieldProps<T> {
  /** Enables inline create for this lookup entity. */
  lookupType?: LookupCreateType;
  /** Parent form values pre-filled in the quick-create modal. */
  lookupContext?: LookupCreateContext;
  /** Override permission check (defaults to modify on the entity route). */
  canCreate?: boolean;
  /** Called after a new option is created and selected. */
  onCreated?: (option: SearchableSelectOption) => void;
}

export function CreatableSearchableMultiSelectField<T extends FieldValues>({
  lookupType,
  lookupContext,
  canCreate: canCreateOverride,
  onCreated,
  selectedLabels,
  ...props
}: CreatableSearchableMultiSelectFieldProps<T>) {
  const queryClient = useQueryClient();
  const { getValues, setValue } = useFormContext<T>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdLabels, setCreatedLabels] = useState<Record<string, string>>({});

  const config = lookupType ? LOOKUP_CREATE_CONFIG[lookupType] : null;
  const hasModifyPermission = useLookupCreatePermission(lookupType);
  const canCreate = lookupType != null && (canCreateOverride ?? hasModifyPermission);

  const mergedLabels = useMemo(
    () => ({ ...selectedLabels, ...createdLabels }),
    [createdLabels, selectedLabels],
  );

  function handleCreated(option: SearchableSelectOption) {
    setCreatedLabels((prev) => ({ ...prev, [option.value]: option.label }));
    const current = getValues(props.name as Path<T>);
    const next = Array.isArray(current)
      ? current.map(String)
      : current == null || current === ""
        ? []
        : [String(current)];
    if (!next.includes(option.value)) {
      setValue(props.name as Path<T>, [...next, option.value] as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    queryClient.setQueriesData<SearchableSelectOption[]>(
      { queryKey: props.queryKey },
      (existing) => {
        if (!existing) return [option];
        if (existing.some((row) => row.value === option.value)) return existing;
        return [option, ...existing];
      },
    );
    for (const key of config?.invalidateQueryKeys ?? []) {
      queryClient.invalidateQueries({ queryKey: key });
    }
    onCreated?.(option);
    setCreateOpen(false);
  }

  return (
    <>
      <SearchableMultiSelectField<T>
        {...props}
        selectedLabels={mergedLabels}
        onAddNew={canCreate ? () => setCreateOpen(true) : undefined}
        addNewLabel={config?.addNewLabel}
      />
      {lookupType && createOpen ? (
        <LookupQuickCreateModal
          type={lookupType}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
          context={lookupContext}
        />
      ) : null}
    </>
  );
}
