import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FieldValues, Path } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import {
  SearchableSelectField,
  type SearchableSelectFieldProps,
  type SearchableSelectOption,
} from "./SearchableSelectField";
import { useLookupCreatePermission } from "./useLookupCreatePermission";
import { LookupQuickCreateModal } from "@/components/lookups/LookupQuickCreateModal";
import { LOOKUP_CREATE_CONFIG, type LookupCreateContext, type LookupCreateType } from "@/lib/lookup-create";

export interface CreatableSearchableSelectFieldProps<T extends FieldValues>
  extends SearchableSelectFieldProps<T> {
  /** Enables inline create for this lookup entity. */
  lookupType?: LookupCreateType;
  /** Parent form values pre-filled in the quick-create modal. */
  lookupContext?: LookupCreateContext;
  /** Override permission check (defaults to modify on the entity route). */
  canCreate?: boolean;
  /** Called after a new option is created and selected. */
  onCreated?: (option: SearchableSelectOption) => void;
}

export function CreatableSearchableSelectField<T extends FieldValues>({
  lookupType,
  lookupContext,
  canCreate: canCreateOverride,
  onCreated,
  selectedLabel,
  onSelect,
  ...props
}: CreatableSearchableSelectFieldProps<T>) {
  const queryClient = useQueryClient();
  const { setValue } = useFormContext<T>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdLabel, setCreatedLabel] = useState<string | null>(null);

  const config = lookupType ? LOOKUP_CREATE_CONFIG[lookupType] : null;
  const hasModifyPermission = useLookupCreatePermission(lookupType);
  const canCreate = lookupType != null && (canCreateOverride ?? hasModifyPermission);

  function handleCreated(option: SearchableSelectOption) {
    setCreatedLabel(option.label);
    setValue(props.name as Path<T>, option.value as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
    queryClient.setQueriesData<SearchableSelectOption[]>(
      { queryKey: props.queryKey },
      (current) => {
        if (!current) return [option];
        if (current.some((row) => row.value === option.value)) return current;
        return [option, ...current];
      },
    );
    for (const key of config?.invalidateQueryKeys ?? []) {
      queryClient.invalidateQueries({ queryKey: key });
    }
    onSelect?.(option);
    onCreated?.(option);
    setCreateOpen(false);
  }

  const resolvedLabel = createdLabel ?? selectedLabel;

  return (
    <>
      <SearchableSelectField<T>
        {...props}
        selectedLabel={resolvedLabel}
        onSelect={(option) => {
          setCreatedLabel(null);
          onSelect?.(option);
        }}
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
