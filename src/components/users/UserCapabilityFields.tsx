import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormFieldHint } from "@/components/form/FormFieldLabel";
import { usePermissions } from "@/contexts/PermissionContext";
import { capabilitiesService } from "@/lib/api/services/access";
import type { UserFormValues } from "@/lib/user-form";
import { cn } from "@/lib/utils";
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
  const { hasCapability } = usePermissions();
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
  const canToggleCode = useCallback(
    (code: string) => hasCapability(code),
    [hasCapability],
  );
  const toggleableRows = useMemo(
    () => rows.filter((item) => canToggleCode(item.code)),
    [canToggleCode, rows],
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
    : "You can only grant commercial permissions you have yourself. Others stay disabled.";

  const allToggleableGranted =
    toggleableRows.length > 0 && toggleableRows.every((item) => item.isGranted);

  return (
    <div className="min-w-0 max-w-full space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="font-display text-sm font-semibold">Rates &amp; commercial</h3>
          <FormFieldHint description={helpText} />
        </div>
        <div className="flex items-center gap-1.5">
          {!ceo && overrides.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={resetToRole}
              disabled={disabled}
            >
              Reset to role
            </Button>
          ) : null}
          {!ceo && toggleableRows.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              disabled={disabled}
              onClick={() => {
                const lockedGranted = rows
                  .filter((item) => !canToggleCode(item.code) && item.isGranted)
                  .map((item) => item.code);
                applyGrantedCodes(
                  allToggleableGranted
                    ? lockedGranted
                    : [...lockedGranted, ...toggleableRows.map((item) => item.code)],
                );
              }}
            >
              {allToggleableGranted ? "Deselect all" : "Select all"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="space-y-0.5">
        {rows.map((item) => {
          const locked = disabled || ceo || !canToggleCode(item.code);
          return (
            <label
              key={item.code}
              className={cn(
                "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                "hover:bg-accent/50",
                locked ? "cursor-not-allowed opacity-60" : "",
              )}
              title={
                !disabled && !ceo && !canToggleCode(item.code)
                  ? "You do not have this permission, so you cannot grant it"
                  : undefined
              }
            >
              <Checkbox
                checked={item.isGranted}
                disabled={locked}
                onCheckedChange={(checked) => {
                  if (!canToggleCode(item.code)) return;
                  const nextCodes = checked
                    ? [...selectedCodes, item.code]
                    : selectedCodes.filter((c) => c.toUpperCase() !== item.code.toUpperCase());
                  applyGrantedCodes(nextCodes);
                }}
              />
              <span className="text-sm font-medium leading-none text-foreground">
                {item.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
