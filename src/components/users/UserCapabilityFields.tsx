import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableMultiSelect } from "@/components/form";
import { FormFieldHint } from "@/components/form/FormFieldLabel";
import type { SearchableSelectOption } from "@/components/form/SearchableSelect";
import { capabilitiesService } from "@/lib/api/services/access";
import type { UserFormValues } from "@/lib/user-form";
import {
  isCeoRole,
  mergeCapabilityRows,
  overridesFromGrantedCodes,
  pruneCapabilityOverrides,
  sameCapabilityOverrides,
} from "@/lib/user-capabilities";

export function UserCapabilityFields({
  disabled = false,
  resetKey,
}: {
  disabled?: boolean;
  resetKey?: string;
}) {
  const { control, setValue } = useFormContext<UserFormValues>();
  const roleId = useWatch({ control, name: "roleId" })?.trim() ?? "";
  const overrides = useWatch({ control, name: "capabilityOverrides" }) ?? [];
  const appliedRoleIdRef = useRef<string | null>(null);

  useEffect(() => {
    appliedRoleIdRef.current = null;
  }, [resetKey]);

  const catalogQuery = useQuery({
    queryKey: ["users", "capability-catalog", roleId],
    queryFn: async () => (await capabilitiesService.getCatalogByRole(roleId)).data,
    enabled: Boolean(roleId),
  });

  const roleItems = catalogQuery.data?.capabilities ?? [];
  const ceo = isCeoRole(catalogQuery.data?.roleCode);
  const rows = mergeCapabilityRows(roleItems, overrides, ceo);
  const catalogReady = Boolean(roleId) && catalogQuery.data?.roleId === roleId;
  const selectedCodes = rows.filter((item) => item.isGranted).map((item) => item.code);
  const selectedLabels = useMemo(
    () => Object.fromEntries(roleItems.map((item) => [item.code, item.label])),
    [roleItems],
  );

  useEffect(() => {
    if (!catalogReady || !roleId) return;

    if (ceo) {
      appliedRoleIdRef.current = roleId;
      if (overrides.length === 0) return;
      setValue("capabilityOverrides", [], { shouldDirty: true, shouldTouch: true });
      return;
    }

    if (appliedRoleIdRef.current === roleId) return;
    const isFirstCatalog = appliedRoleIdRef.current == null;
    appliedRoleIdRef.current = roleId;
    if (isFirstCatalog) return;

    const next = pruneCapabilityOverrides(overrides, roleItems);
    if (sameCapabilityOverrides(overrides, next)) return;
    setValue("capabilityOverrides", next, { shouldDirty: true, shouldTouch: true });
  }, [catalogReady, ceo, overrides, roleId, roleItems, setValue]);

  const fetchOptions = useCallback(
    async (search: string): Promise<SearchableSelectOption[]> => {
      const query = search.trim().toLowerCase();
      return roleItems
        .filter((item) => {
          if (!query) return true;
          return (
            item.label.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.code.toLowerCase().includes(query)
          );
        })
        .map((item) => ({
          value: item.code,
          label: item.label,
          description: item.description,
        }));
    },
    [roleItems],
  );

  function applyGrantedCodes(codes: string[]) {
    setValue("capabilityOverrides", overridesFromGrantedCodes(codes, roleItems), {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function resetToRole() {
    if (overrides.length === 0) return;
    setValue("capabilityOverrides", [], { shouldDirty: true, shouldTouch: true });
  }

  if (!roleId) {
    return (
      <p className="text-xs text-muted-foreground">Select a role to set rates &amp; commercial flags.</p>
    );
  }

  if (catalogQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading role defaults…
      </div>
    );
  }

  if (catalogQuery.isError) {
    return (
      <p className="text-xs text-destructive">Unable to load rates &amp; commercial flags for this role.</p>
    );
  }

  const helpText = ceo
    ? "CEO always has every commercial permission. This list cannot be narrowed here."
    : "Selected flags are granted. Role defaults stay selected until you change them.";

  return (
    <div className="min-w-0 max-w-full space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <FormFieldHint description={helpText} />
        {!ceo && overrides.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={resetToRole}
            disabled={disabled}
          >
            Reset to role
          </Button>
        ) : null}
      </div>
      <SearchableMultiSelect
        value={selectedCodes}
        onValueChange={applyGrantedCodes}
        placeholder="Select commercial permissions…"
        searchPlaceholder="Search permissions…"
        disabled={disabled || ceo}
        queryKey={["users", "capability-options", roleId, roleItems.map((item) => item.code).join(",")]}
        fetchOptions={fetchOptions}
        selectedLabels={selectedLabels}
        aria-label="Rates and commercial permissions"
      />
    </div>
  );
}
