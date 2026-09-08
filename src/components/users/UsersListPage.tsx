import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  downloadCsv,
  csvForceText,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { Plus, Eye, Pencil, Trash2, Loader2, Download, User } from "lucide-react";
import { toast } from "sonner";
import {
  usersService,
  resolveProfileImageUrl,
  toDateInputValue,
  type ApiUser,
  type UsersSortBy,
} from "@/lib/api/services/users";
import { lookupsService } from "@/lib/api/services/lookups";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_BADGE, ROLE_LABEL, type UserRole } from "@/lib/users-store";
import { AppTooltip } from "@/components/AppTooltip";
import { TableImagePreview } from "@/components/TableImagePreview";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { formatDailyRate, truncateWithEllipsis } from "@/lib/module-ui";
import { useUserModuleMode, userModuleConfig } from "@/lib/user-module";
import { HierarchyCreateWizard } from "@/components/hierarchy/HierarchyCreateWizard";
import { ClientEditModal } from "@/components/hierarchy/ClientEditModal";

const ROLE_NAME_TO_KEY = Object.entries(ROLE_LABEL).reduce<Record<string, UserRole>>(
  (acc, [key, label]) => {
    acc[label] = key as UserRole;
    acc[key] = key as UserRole;
    return acc;
  },
  {},
);

const FALLBACK_ROLE_BADGES = [
  "bg-info/10 text-info border-info/20",
  "bg-warning/15 text-warning-foreground border-warning/30",
  "bg-accent/15 text-accent border-accent/30",
  "bg-secondary text-secondary-foreground border-border",
] as const;

function roleBadgeClass(roleName: string, index: number): string {
  const key = ROLE_NAME_TO_KEY[roleName];
  if (key === "PM") return "bg-accent/20 text-accent border-accent/35";
  if (key && ROLE_BADGE[key]) return ROLE_BADGE[key];
  return FALLBACK_ROLE_BADGES[index % FALLBACK_ROLE_BADGES.length];
}

export function displayUserName(user: ApiUser) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username;
}

export function UsersListPage() {
  const mode = useUserModuleMode();
  const cfg = userModuleConfig(mode);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: cfg.permissionRoute, action: "modify" });
  const canDelete = usePermission({ route: cfg.permissionRoute, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleId, setRoleId] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<UsersSortBy>("createdDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const columnSortKeys = useMemo<Record<string, UsersSortBy>>(
    () => ({
      name: "name",
      status: "status",
      ...(cfg.isOperative
        ? { trade: "trade" as const, cis: "cis" as const, dailyRate: "dailyrate" as const }
        : cfg.hideAccessFields
          ? {}
          : { role: "roles" as const }),
    }),
    [cfg.hideAccessFields, cfg.isOperative],
  );

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await lookupsService.roles()).data,
    staleTime: 60_000,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...cfg.queryKey, { page, pageSize, search, roleId, sortBy, sortDir }],
    queryFn: async () =>
      (
        await usersService.list({
          page,
          pageSize,
          search,
          roleId,
          userTypeId: cfg.userTypeId,
          sortBy,
          sortDir,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || `${cfg.labels.entityTitle} deleted`);
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: cfg.queryKey });
    },
    onError: (err) => notifyApiError(err, `Failed to delete ${cfg.labels.entity}`),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.warning(`No ${cfg.labels.itemLabel} to export for the current page.`);
      return;
    }
    setExporting(true);
    try {
      const headers = cfg.isOperative
        ? ["Name", "Email", "Phone", "Trades", "CIS", "Daily rate", "Status"]
        : cfg.isContractor
          ? ["Name", "Company name", "Email", "Phone", "Address", "City", "State", "Country", "ZIP Code", "Status"]
          : cfg.isCustomer
            ? [
                "Name",
                "Code",
                "Email",
                "Phone",
                "Address",
                "City",
                "State",
                "Country",
                "ZIP Code",
                "Status",
              ]
            : ["Name", "Email", "Phone", "Date of birth", "Roles", "Status"];
      downloadCsv({
        filename: `${cfg.labels.itemLabel}-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows: rows.map((user) =>
          cfg.isOperative
            ? [
                displayUserName(user),
                user.email,
                csvForceText(user.phone ?? ""),
                user.tradeName ?? "",
                user.cisName ?? "",
                user.dailyRate != null ? String(user.dailyRate) : "",
                user.isActive ? "Active" : "Inactive",
              ]
            : cfg.isContractor
              ? [
                  displayUserName(user),
                  user.companyName ?? "",
                  user.email,
                  csvForceText(user.phone ?? ""),
                  user.address ?? "",
                  user.city ?? "",
                  user.state ?? "",
                  user.country ?? "",
                  user.zipCode ?? "",
                  user.isActive ? "Active" : "Inactive",
                ]
              : cfg.isCustomer
                ? [
                    displayUserName(user),
                    user.clientCode ?? "",
                    user.email,
                    csvForceText(user.phone ?? ""),
                    user.address ?? "",
                    user.city ?? "",
                    user.state ?? "",
                    user.country ?? "",
                    user.zipCode ?? "",
                    user.isActive ? "Active" : "Inactive",
                  ]
                : [
                  displayUserName(user),
                  user.email,
                  csvForceText(user.phone ?? ""),
                  toDateInputValue(user.dateOfBirth),
                  (user.roleNames ?? []).join("; "),
                  user.isActive ? "Active" : "Inactive",
                ],
        ),
      });
      toast.success(
        `Exported ${rows.length} ${cfg.labels.entity}${rows.length === 1 ? "" : "s"} to CSV`,
      );
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiUser>[]>(() => {
    const cols: DataTableColumn<ApiUser>[] = [
      {
        id: "name",
        header: "Name",
        sortable: true,
        truncate: false,
        width: "24rem",
        cell: (user) => {
          const name = displayUserName(user);
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="shrink-0">
                <UserAvatar name={name} src={resolveProfileImageUrl(user.profileImagePath)} />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <AppTooltip content={name} asChild align="start">
                  <Link
                    to={cfg.detailPath}
                    params={{ id: String(user.id) }}
                    className="inline-block max-w-full cursor-pointer font-medium text-info"
                  >
                    {truncateWithEllipsis(name)}
                  </Link>
                </AppTooltip>
                {user.email ? (
                  <div className="mt-0.5 min-w-0 text-[11px] text-muted-foreground">
                    <AppTooltip content={user.email} asChild align="start">
                      <span className="block min-w-0 truncate">{user.email}</span>
                    </AppTooltip>
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
    ];

    if (cfg.isOperative) {
      cols.push(
        {
          id: "trade",
          header: "Trades",
          sortable: true,
          cell: (user) => user.tradeName || "—",
        },
        {
          id: "cis",
          header: "CIS",
          sortable: true,
          cell: (user) => user.cisName || "—",
        },
        {
          id: "dailyRate",
          header: "Daily rate",
          sortable: true,
          cell: (user) => (
            <span className="whitespace-nowrap font-mono tabular-nums">
              {formatDailyRate(user.dailyRate)}
            </span>
          ),
        },
      );
    }

    if (cfg.isContactModule) {
      if (cfg.isContractor) {
        cols.push(
          {
            id: "companyName",
            header: "Company name",
            cell: (user) => user.companyName || "—",
          },
          {
            id: "address",
            header: "Address",
            cell: (user) => user.address || "—",
          },
          {
            id: "city",
            header: "City",
            cell: (user) => user.city || "—",
          },
        );
      } else if (cfg.isCustomer) {
        cols.push(
          {
            id: "clientCode",
            header: "Code",
            cell: (user) => user.clientCode || "—",
          },
          {
            id: "address",
            header: "Address",
            cell: (user) => user.address || "—",
          },
        );
      }
    }

    if (!cfg.isOperative) {
      if (!cfg.hideAccessFields) {
        cols.push({
          id: "role",
          header: "Role",
          sortable: true,
          truncate: false,
          cell: (user) => (
            <div className="flex flex-wrap gap-1">
              {(user.roleNames ?? []).map((role, index) => (
                <span
                  key={`${user.id}-${role}`}
                  className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClass(role, index)}`}
                >
                  {role}
                </span>
              ))}
              {(!user.roleNames || user.roleNames.length === 0) && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          ),
        });
      }
    }

    cols.push({
      id: "status",
      header: "Status",
      sortable: true,
      cell: (user) => <ActiveStatusBadge isActive={user.isActive} />,
    });

    return cols;
  }, [cfg.detailPath, cfg.hideAccessFields, cfg.isContactModule, cfg.isCustomer, cfg.isOperative]);

  const rowActions = useMemo<DataTableRowAction<ApiUser>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (user) =>
          navigate({ to: cfg.detailPath, params: { id: user.id } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (user) => {
          if (cfg.isCustomer) {
            setEditClientId(String(user.id));
            return;
          }
          navigate({
            to: cfg.detailPath,
            params: { id: user.id },
            search: { mode: "edit" },
          });
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        hidden: () => !canDelete,
        onClick: (user) => setConfirmDel(user),
      },
    ],
    [canDelete, canModify, cfg.detailPath, cfg.isCustomer, navigate],
  );

  const activeSortColumn =
    Object.entries(columnSortKeys).find(([, apiKey]) => apiKey === sortBy)?.[0] ?? "";

  function handleSortChange(columnId: string, direction: "asc" | "desc") {
    const apiSortBy = columnSortKeys[columnId];
    if (!apiSortBy) return;
    setSortBy(apiSortBy);
    setSortDir(direction);
    setPage(1);
  }

  function clearFilters() {
    clearSearch();
    setRoleId(undefined);
    setPage(1);
  }

  const hasActiveFilters = Boolean(search) || roleId != null;
  const roles = rolesQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title={cfg.labels.moduleTitle}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || isLoading}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </Button>
            <Can route={cfg.permissionRoute} action="modify">
              {cfg.isCustomer ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {cfg.labels.addButton}
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <Link to={cfg.newPath}>
                    <Plus className="h-4 w-4" />
                    {cfg.labels.addButton}
                  </Link>
                </Button>
              )}
            </Can>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(user) => user.id}
        loading={isLoading}
        fetching={isFetching}
        loadingText={cfg.labels.loadingList}
        error={
          isError
            ? {
                title: `Unable to load ${cfg.labels.itemLabel}`,
                message: (error as unknown as ApiError)?.message || "Please try again.",
                onRetry: () => {
                  void refetch();
                },
              }
            : null
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: cfg.labels.searchPlaceholder,
          "aria-label": `Search ${cfg.labels.itemLabel}`,
        }}
        filters={
          cfg.hideAccessFields ? undefined : (
            <Select
              value={roleId ?? "all"}
              onValueChange={(value) => {
                setRoleId(value === "all" ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger
                className="h-9 w-full min-w-[11rem] sm:w-60 [&>span]:whitespace-nowrap"
                aria-label="Filter by role"
              >
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
        sort={{
          sortBy: activeSortColumn,
          sortDir,
          onSortChange: handleSortChange,
        }}
        emptyState={{
          title: cfg.labels.emptyTitle,
          description: cfg.hideAccessFields
            ? "Try clearing the search."
            : "Try clearing the search or role filter.",
          action: hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined,
        }}
        rowActions={rowActions}
        pagination={{
          page,
          pageSize,
          totalCount,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          itemLabel: cfg.labels.itemLabel,
          disabled: isFetching,
          controlsAlign: "center",
        }}
      />

      {createOpen && cfg.isCustomer ? (
        <HierarchyCreateWizard
          customersQueryKey={cfg.queryKey}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}

      {editClientId && cfg.isCustomer ? (
        <ClientEditModal customerId={editClientId} onClose={() => setEditClientId(null)} />
      ) : null}

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmDel(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">
              Delete {displayUserName(confirmDel)}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{cfg.labels.deleteConfirm}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDel(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDel.id)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {cfg.labels.deleteButton}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserAvatar({ name, src }: { name: string; src: string }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <TableImagePreview
      src={src}
      alt={name}
      className="h-8 w-8 rounded-full"
      fallback={
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
          {initials || <User className="h-4 w-4" />}
        </span>
      }
    />
  );
}
