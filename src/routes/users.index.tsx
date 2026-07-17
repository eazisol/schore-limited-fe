import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Can, usePermission } from "@/components/Permission";
import {
  DataTable,
  downloadCsv,
  fetchAllPages,
  useDebouncedSearch,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/data-table";
import { Plus, Eye, Pencil, Trash2, Mail, Loader2, Download, User } from "lucide-react";
import { toast } from "sonner";
import { usersService, resolveProfileImageUrl, type ApiUser, type UsersSortBy } from "@/lib/api/services/users";
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

const USERS_ROUTE = "/users";

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

export const Route = createFileRoute("/users/")({
  head: () => ({ meta: [{ title: "User Management | Schore" }] }),
  component: UsersList,
});

export const usersQueryKey = ["users"] as const;

const USER_COLUMN_SORT_KEYS: Record<string, UsersSortBy> = {
  name: "name",
  role: "roles",
  status: "status",
};

function roleBadgeClass(roleName: string, index: number): string {
  const key = ROLE_NAME_TO_KEY[roleName];
  if (key === "PM") return "bg-accent/20 text-accent border-accent/35";
  if (key && ROLE_BADGE[key]) return ROLE_BADGE[key];
  return FALLBACK_ROLE_BADGES[index % FALLBACK_ROLE_BADGES.length];
}

function displayName(user: ApiUser) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username;
}

function UsersList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: USERS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: USERS_ROUTE, action: "delete" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [roleId, setRoleId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<UsersSortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [confirmDel, setConfirmDel] = useState<ApiUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const { searchInput, setSearchInput, search, clearSearch } = useDebouncedSearch({
    onPageReset: () => setPage(1),
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await lookupsService.roles()).data,
    staleTime: 60_000,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...usersQueryKey, { page, pageSize, search, roleId, sortBy, sortDir }],
    queryFn: async () =>
      (
        await usersService.list({
          page,
          pageSize,
          search,
          roleId,
          sortBy,
          sortDir,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersService.remove(id),
    onSuccess: () => {
      const name = confirmDel?.firstName || confirmDel?.username || "User";
      toast.success(`${name} deleted`);
      setConfirmDel(null);
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete user"),
  });

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  async function handleExportCsv() {
    setExporting(true);
    try {
      const users = await fetchAllPages<ApiUser>({
        search,
        fetchPage: async ({ page: exportPage, pageSize: exportPageSize, search: exportSearch }) =>
          (
            await usersService.list({
              page: exportPage,
              pageSize: exportPageSize,
              search: exportSearch,
              roleId,
              sortBy,
              sortDir,
            })
          ).data,
      });
      if (users.length === 0) {
        toast.warning("No users to export for the current filters.");
        return;
      }
      downloadCsv({
        filename: `users-export-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ["Name", "Email", "Roles", "Status"],
        rows: users.map((user) => [
          displayName(user),
          user.email,
          (user.roleNames ?? []).join("; "),
          user.isActive ? "Active" : "Inactive",
        ]),
      });
      toast.success(`Exported ${users.length} user${users.length === 1 ? "" : "s"} to CSV`);
    } catch (err) {
      notifyApiError(err, "Failed to export users");
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<DataTableColumn<ApiUser>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        cell: (user) => {
          const name = displayName(user);
          return (
            <div className="flex items-center gap-3">
              <UserAvatar name={name} src={resolveProfileImageUrl(user.profileImagePath)} />
              <div className="min-w-0">
                <Link
                  to="/users/$id"
                  params={{ id: String(user.id) }}
                  className="block truncate font-medium hover:text-info hover:underline"
                  title={name}
                >
                  {name}
                </Link>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Role",
        sortable: true,
        cell: (user) => (
          <div className="flex flex-wrap gap-1">
            {(user.roleNames ?? []).map((role, index) => (
              <span
                key={`${user.id}-${role}`}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClass(role, index)}`}
              >
                {role}
              </span>
            ))}
            {(!user.roleNames || user.roleNames.length === 0) && (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (user) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              user.isActive
                ? "border-success/20 bg-success/10 text-success"
                : "border-destructive/20 bg-destructive/10 text-destructive"
            }`}
          >
            {user.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<ApiUser>[]>(
    () => [
      {
        id: "view",
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (user) => navigate({ to: "/users/$id", params: { id: String(user.id) } }),
      },
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        hidden: () => !canModify,
        onClick: (user) => navigate({ to: "/users/$id", params: { id: String(user.id) } }),
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
    [canDelete, canModify, navigate],
  );

  const activeSortColumn =
    Object.entries(USER_COLUMN_SORT_KEYS).find(([, apiKey]) => apiKey === sortBy)?.[0] ?? "name";

  function handleSortChange(columnId: string, direction: "asc" | "desc") {
    const apiSortBy = USER_COLUMN_SORT_KEYS[columnId];
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
        title="User Management"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || isLoading}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </Button>
            <Can route={USERS_ROUTE} action="modify">
              <Button size="sm" asChild>
                <Link to="/users/new">
                  <Plus className="h-4 w-4" />
                  Add user
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(user) => user.id}
        loading={isLoading}
        fetching={isFetching}
        loadingText="Loading users…"
        error={
          isError
            ? {
                title: "Unable to load users",
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
          placeholder: "Search by name, username or email…",
          "aria-label": "Search users",
        }}
        filters={
          <Select
            value={roleId != null ? String(roleId) : "all"}
            onValueChange={(value) => {
              setRoleId(value === "all" ? undefined : Number(value));
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
        }
        sort={{
          sortBy: activeSortColumn,
          sortDir,
          onSortChange: handleSortChange,
        }}
        emptyState={{
          title: "No users match your filters",
          description: "Try clearing the search or role filter.",
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
          itemLabel: "users",
          disabled: isFetching,
          controlsAlign: "center",
        }}
      />

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
              Delete {displayName(confirmDel)}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the account and revokes platform access. This action cannot be
              undone.
            </p>
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
                Delete user
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

  if (src) {
    return <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
      {initials || <User className="h-4 w-4" />}
    </span>
  );
}
