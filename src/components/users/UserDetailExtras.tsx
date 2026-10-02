import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import {
  toDateInputValue,
  type ApiUser,
} from "@/lib/api/services/users";
import { capabilitiesService } from "@/lib/api/services/access";
import { permissionsService } from "@/lib/api/services/permissions";
import { formatDateTime } from "@/lib/module-ui";
import { isNonEmptyId } from "@/lib/ids";

const TAB_TRIGGER_CLASS =
  "h-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 shadow-none data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:border-primary";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-3 sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="text-sm font-medium sm:col-span-2">{value || "—"}</dd>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <p className="px-1 py-8 text-center text-sm text-muted-foreground">{message}</p>
  );
}

export function UserDetailExtras({
  user,
  canEdit,
  onEdit,
}: {
  user: ApiUser;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const roleId = user.roleIds?.[0] ? String(user.roleIds[0]) : "";
  const roleLabel = (user.roleNames ?? []).filter(Boolean).join(", ") || "—";
  const assignments = user.scopeAssignments ?? [];
  const capabilityOverrides = user.capabilityOverrides ?? [];
  const menuOverrides = user.menuPermissionOverrides ?? [];

  const capabilityCatalogQuery = useQuery({
    queryKey: ["users", "capability-catalog", roleId],
    queryFn: async () => (await capabilitiesService.getCatalogByRole(roleId)).data,
    enabled: isNonEmptyId(roleId),
  });

  const menuCatalogQuery = useQuery({
    queryKey: ["users", "menu-permission-catalog", roleId],
    queryFn: async () => (await permissionsService.getCatalogByRole(roleId)).data,
    enabled: isNonEmptyId(roleId),
  });

  const capabilityLabelByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of capabilityCatalogQuery.data?.capabilities ?? []) {
      map[item.code] = item.label;
    }
    return map;
  }, [capabilityCatalogQuery.data]);

  const menuLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of menuCatalogQuery.data?.permissions ?? []) {
      const id = String(item.menuId ?? "");
      if (!id) continue;
      map[id] = item.menuName?.trim() || item.menuCode?.trim() || id;
    }
    return map;
  }, [menuCatalogQuery.data]);

  const addLabel =
    tab === "overview"
      ? "Edit details"
      : tab === "access"
        ? "Edit access"
        : tab === "commercial"
          ? "Edit commercial"
          : "Edit permissions";

  return (
    <section className="card-elevated min-w-0 overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 pt-1 sm:px-4">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <TabsList className="inline-flex h-auto w-max min-w-full flex-row items-start justify-start gap-1 rounded-none bg-transparent p-0 pb-0 sm:gap-2">
              <TabsTrigger value="overview" className={TAB_TRIGGER_CLASS}>
                Overview
              </TabsTrigger>
              <TabsTrigger value="access" className={TAB_TRIGGER_CLASS}>
                Access
              </TabsTrigger>
              <TabsTrigger value="commercial" className={TAB_TRIGGER_CLASS}>
                Rates &amp; commercial
              </TabsTrigger>
              <TabsTrigger value="permissions" className={TAB_TRIGGER_CLASS}>
                Menu access
              </TabsTrigger>
            </TabsList>
          </div>
          {canEdit && onEdit ? (
            <Button
              size="sm"
              className="mb-1 h-7 shrink-0 gap-1 px-2.5 text-[11px] font-medium shadow-none [&_svg]:!size-3"
              onClick={onEdit}
            >
              <Pencil />
              {addLabel}
            </Button>
          ) : null}
        </div>

        <TabsContent value="overview" className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5">
          <dl className="divide-y divide-border">
            <DetailRow label="First name" value={user.firstName?.trim()} />
            <DetailRow label="Last name" value={user.lastName?.trim()} />
            <DetailRow label="Email" value={user.email?.trim()} />
            <DetailRow label="Username" value={user.username?.trim()} />
            <DetailRow label="Phone" value={user.phone?.trim()} />
            <DetailRow
              label="Date of birth"
              value={toDateInputValue(user.dateOfBirth) || undefined}
            />
            <DetailRow label="User type" value={user.userTypeName?.trim()} />
            <DetailRow label="Status" value={<ActiveStatusBadge isActive={user.isActive} />} />
            <DetailRow
              label="Created"
              value={user.createdDate ? formatDateTime(user.createdDate) : undefined}
            />
            <DetailRow
              label="Last updated"
              value={user.editDate ? formatDateTime(user.editDate) : undefined}
            />
          </dl>
        </TabsContent>

        <TabsContent value="access" className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5">
          <dl className="mb-4 divide-y divide-border">
            <DetailRow label="Role" value={roleLabel} />
          </dl>
          <h4 className="mb-2 font-display text-sm font-semibold">Project assignments</h4>
          {assignments.length === 0 ? (
            <EmptyPanel message="No project assignments. This user follows role defaults for access scope." />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Client</th>
                    <th className="px-3 py-2 text-left font-medium">Site</th>
                    <th className="px-3 py-2 text-left font-medium">Project</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 font-medium">
                        {row.customerName?.trim() || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.siteName?.trim() || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.projectName?.trim() || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="commercial"
          className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5"
        >
          {capabilityOverrides.length === 0 ? (
            <EmptyPanel message="No commercial capability overrides. Role defaults apply." />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Capability</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {capabilityOverrides.map((row) => (
                    <tr key={row.code}>
                      <td className="px-3 py-2 font-medium">
                        {capabilityLabelByCode[row.code] || row.code}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            row.isGranted
                              ? "text-success"
                              : "text-muted-foreground"
                          }
                        >
                          {row.isGranted ? "Granted" : "Removed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="permissions"
          className="mt-0 px-4 py-3 focus-visible:outline-none sm:px-5"
        >
          {menuOverrides.length === 0 ? (
            <EmptyPanel message="No menu access overrides. Role defaults apply." />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Menu</th>
                    <th className="px-3 py-2 text-center font-medium">Read</th>
                    <th className="px-3 py-2 text-center font-medium">Modify</th>
                    <th className="px-3 py-2 text-center font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {menuOverrides.map((row) => (
                    <tr key={row.menuId}>
                      <td className="px-3 py-2 font-medium">
                        {menuLabelById[String(row.menuId)] || String(row.menuId)}
                      </td>
                      <td className="px-3 py-2 text-center">{row.read ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-center">{row.modify ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-center">{row.delete ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
