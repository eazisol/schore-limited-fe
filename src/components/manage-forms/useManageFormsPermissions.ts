import { usePermission } from "@/components/Permission";
import { MANAGE_FORMS_ROUTE } from "@/lib/manage-forms";

export function useManageFormsPermissions() {
  const canModify = usePermission({ route: MANAGE_FORMS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: MANAGE_FORMS_ROUTE, action: "delete" });
  return { canModify, canDelete };
}
