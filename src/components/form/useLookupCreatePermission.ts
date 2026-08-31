import { usePermission } from "@/components/Permission";
import { LOOKUP_CREATE_CONFIG, type LookupCreateType } from "@/lib/lookup-create";

function useAnyRoutePermission(routes: readonly string[] | undefined): boolean {
  const permissions = [
    usePermission({ route: routes?.[0], action: "modify" }),
    usePermission({ route: routes?.[1], action: "modify" }),
    usePermission({ route: routes?.[2], action: "modify" }),
    usePermission({ route: routes?.[3], action: "modify" }),
  ];

  if (!routes?.length) return false;
  return routes.some((_, index) => permissions[index]);
}

/** True when the user may create records for this lookup from a dropdown. */
export function useLookupCreatePermission(lookupType: LookupCreateType | undefined): boolean {
  if (!lookupType) return false;
  return useAnyRoutePermission(LOOKUP_CREATE_CONFIG[lookupType].permissionRoutes);
}
