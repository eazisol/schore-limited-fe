import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import { Can, usePermission } from "@/components/Permission";
import { Plus, Search, Eye, Pencil, Trash2, Mail, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { usersService, type ApiUser } from "@/lib/api/services/users";
import { notifyApiError, type ApiError } from "@/lib/api/axios";

const USERS_ROUTE = "/users";

export const Route = createFileRoute("/users/")({
  head: () => ({ meta: [{ title: "User Management — Schore" }] }),
  component: UsersList,
});

export const usersQueryKey = ["users"] as const;

function UsersList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModify = usePermission({ route: USERS_ROUTE, action: "modify" });
  const canDelete = usePermission({ route: USERS_ROUTE, action: "delete" });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [confirmDel, setConfirmDel] = useState<ApiUser | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(prev => {
        if (prev === searchInput.trim()) return prev;
        setPage(1);
        return searchInput.trim();
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...usersQueryKey, { page, pageSize, search }],
    queryFn: async () => (await usersService.list({ page, pageSize, search })).data,
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

  const headerRange = useMemo(() => {
    if (totalCount === 0) return "0 of 0";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalCount);
    return `${start}–${end} of ${totalCount}`;
  }, [page, pageSize, totalCount]);

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Platform users · roles, access and account status"
        actions={
          <Can route={USERS_ROUTE} action="modify">
            <Button size="sm" asChild>
              <Link to="/users/new"><Plus className="h-4 w-4" />Add user</Link>
            </Button>
          </Can>
        }
      />

      <div className="card-elevated">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-80">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by name, username or email…"
              className="bg-transparent text-sm outline-none w-full"
              aria-label="Search users"
            />
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{headerRange}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 grid place-items-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mb-2" />
            Loading users…
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-5 w-5 mx-auto text-destructive mb-2" />
            <div className="text-sm font-medium">Unable to load users</div>
            <p className="text-xs text-muted-foreground mt-1">{(error as unknown as ApiError)?.message || "Please try again."}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm font-medium">No users match your filters</div>
            <p className="text-xs text-muted-foreground mt-1">Try clearing the search.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchInput(""); }}>
              Clear search
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Name</th>
                  <th className="text-left font-medium px-3 py-2.5">Username</th>
                  <th className="text-left font-medium px-3 py-2.5">Roles</th>
                  <th className="text-left font-medium px-3 py-2.5">User type</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                  <th className="text-right font-medium px-5 py-2.5 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((u: ApiUser) => {
                  const displayName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <Link to="/users/$id" params={{ id: String(u.id) }} className="font-medium hover:text-info hover:underline">
                          {displayName}
                        </Link>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> {u.email}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{u.username}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.roleNames ?? []).map((r: string) => (
                            <span key={r} className="text-[11px] px-2 py-0.5 rounded-full border bg-muted">{r}</span>
                          ))}
                          {(!u.roleNames || u.roleNames.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{u.userTypeName || "—"}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${u.isActive ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconBtn label="View" onClick={() => navigate({ to: "/users/$id", params: { id: String(u.id) } })}>
                            <Eye className="h-4 w-4" />
                          </IconBtn>
                          {canModify && (
                            <IconBtn label="Edit" onClick={() => navigate({ to: "/users/$id", params: { id: String(u.id) } })}>
                              <Pencil className="h-4 w-4" />
                            </IconBtn>
                          )}
                          {canDelete && (
                            <IconBtn label="Delete" danger onClick={() => setConfirmDel(u)}>
                              <Trash2 className="h-4 w-4" />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={s => { setPageSize(s); setPage(1); }}
            itemLabel="users"
            disabled={isFetching}
          />
        )}
      </div>

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setConfirmDel(null)}>
          <div className="bg-card rounded-lg max-w-md w-full p-6 border" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg">
              Delete {`${confirmDel.firstName ?? ""} ${confirmDel.lastName ?? ""}`.trim() || confirmDel.username}?
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              This permanently removes the account and revokes platform access. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setConfirmDel(null)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDel.id)}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete user
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, label, danger }: { children: React.ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-8 w-8 inline-grid place-items-center rounded-md hover:bg-accent/40 ${danger ? "text-destructive hover:bg-destructive/10" : ""}`}
    >
      {children}
    </button>
  );
}
