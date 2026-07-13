import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Search, MoreHorizontal, Trash2, Mail, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { usersService, type ApiUser } from "@/lib/api/services/users";
import type { ApiError } from "@/lib/api/axios";

export const Route = createFileRoute("/users/")({
  head: () => ({ meta: [{ title: "User Management — Schore" }] }),
  component: UsersList,
});

export const usersQueryKey = ["users"] as const;

function UsersList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"All" | "Active" | "Inactive">("All");
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiUser | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: usersQueryKey,
    queryFn: async () => (await usersService.list()).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersService.remove(id),
    onSuccess: (_res, id) => {
      const name = confirmDel?.firstName || confirmDel?.username || "User";
      toast.success(`${name} deleted`);
      setConfirmDel(null);
      queryClient.setQueryData<ApiUser[] | undefined>(usersQueryKey, prev =>
        prev ? prev.filter(u => u.id !== id) : prev,
      );
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
    onError: (err: ApiError) => {
      toast.error(err?.message || "Failed to delete user");
    },
  });

  const users = data ?? [];
  const rows = useMemo(
    () =>
      users.filter(u => {
        const hay = `${u.firstName} ${u.lastName} ${u.username} ${u.email}`.toLowerCase();
        if (q && !hay.includes(q.toLowerCase())) return false;
        if (status === "Active" && !u.isActive) return false;
        if (status === "Inactive" && u.isActive) return false;
        return true;
      }),
    [users, q, status],
  );

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
    }),
    [users],
  );

  return (
    <div onClick={() => setMenuFor(null)}>
      <PageHeader
        title="User Management"
        subtitle="Platform users · roles, access and account status"
        actions={
          <Button size="sm" asChild>
            <Link to="/users/new"><Plus className="h-4 w-4" />Add user</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Total users" value={counts.total} />
        <Stat label="Active" value={counts.active} />
        <Stat label="Inactive" value={counts.inactive} tone={counts.inactive > 0 ? "warn" : undefined} />
      </div>

      <div className="card-elevated">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-80">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, username or email…"
              className="bg-transparent text-sm outline-none w-full"
              aria-label="Search users"
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as "All" | "Active" | "Inactive")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by status"
          >
            {["All", "Active", "Inactive"].map(s => <option key={s}>{s}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{rows.length} of {users.length}</span>
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
            <p className="text-xs text-muted-foreground mt-1">{(error as ApiError)?.message || "Please try again."}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm font-medium">No users match your filters</div>
            <p className="text-xs text-muted-foreground mt-1">Try clearing the search or status filter.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQ(""); setStatus("All"); }}>
              Clear filters
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
                  <th className="text-right font-medium px-5 py-2.5 w-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(u => {
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
                          {(u.roleNames ?? []).map(r => (
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
                      <td className="px-5 py-3 text-right relative">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setMenuFor(menuFor === u.id ? null : u.id); }}
                          className="h-8 w-8 inline-grid place-items-center rounded-md hover:bg-accent/40"
                          aria-label={`Actions for ${displayName}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuFor === u.id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute right-5 top-10 z-10 w-52 rounded-md border bg-popover shadow-lg py-1 text-left"
                          >
                            <MenuItem onClick={() => { setMenuFor(null); navigate({ to: "/users/$id", params: { id: String(u.id) } }); }}>
                              Edit user
                            </MenuItem>
                            <MenuItem danger onClick={() => { setMenuFor(null); setConfirmDel(u); }}>
                              <Trash2 className="h-4 w-4" /> Delete user
                            </MenuItem>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/40 ${danger ? "text-destructive" : ""}`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="card-elevated p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-display font-semibold mt-1 tabular-nums ${tone === "warn" ? "text-warning-foreground" : ""}`}>{value}</div>
    </div>
  );
}
