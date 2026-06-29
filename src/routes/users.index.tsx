import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ROLES, ROLE_BADGE, useUsers, usersStore, type UserRole } from "@/lib/users-store";
import { Can, useCan } from "@/components/Can";
import { Plus, Search, MoreHorizontal, UserCheck, UserX, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/users/")({
  head: () => ({ meta: [{ title: "User Management — Schore" }] }),
  component: UsersList,
});

function UsersList() {
  const canView = useCan("users.view");
  const canManage = useCan("users.manage");
  if (!canView) return <Navigate to="/forbidden" />;

  const users = useUsers();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const rows = useMemo(() => users.filter(u => {
    if (q && !u.name.toLowerCase().includes(q.toLowerCase()) && !u.email.toLowerCase().includes(q.toLowerCase())) return false;
    if (role !== "All" && u.role !== role) return false;
    if (status !== "All" && u.status !== status) return false;
    return true;
  }), [users, q, role, status]);

  const counts = useMemo(() => ({
    total: users.length,
    ceos: users.filter(u => u.role === "CEO").length,
    managers: users.filter(u => u.role === "CM" || u.role === "PM").length,
    inactive: users.filter(u => u.status === "Inactive").length,
  }), [users]);


  const target = confirmDel ? users.find(u => u.id === confirmDel) : null;

  return (
    <div onClick={() => setMenuFor(null)}>
      <PageHeader
        title="User Management"
        subtitle="Platform users · roles, access and account status"
        actions={
          <Can permission="users.manage">
            <Button size="sm" asChild>
              <Link to="/users/new"><Plus className="h-4 w-4" />Add user</Link>
            </Button>
          </Can>
        }

      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Total users" value={counts.total} />
        <Stat label="CEOs" value={counts.ceos} />
        <Stat label="Managers" value={counts.managers} />
        <Stat label="Inactive" value={counts.inactive} tone={counts.inactive > 0 ? "warn" : undefined} />

      </div>

      <div className="card-elevated">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-80">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="bg-transparent text-sm outline-none w-full"
              aria-label="Search users"
            />
          </div>
          <select value={role} onChange={e => setRole(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" aria-label="Filter by role">
            {["All", ...ROLES].map(r => <option key={r}>{r}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" aria-label="Filter by status">
            {["All", "Active", "Inactive"].map(s => <option key={s}>{s}</option>)}
          </select>
          <div className="ml-auto text-xs text-muted-foreground">{rows.length} of {users.length}</div>
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm font-medium">No users match your filters</div>
            <p className="text-xs text-muted-foreground mt-1">Try clearing the search, role or status filter.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQ(""); setRole("All"); setStatus("All"); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Name</th>
                  <th className="text-left font-medium px-3 py-2.5">Role</th>
                  <th className="text-left font-medium px-3 py-2.5">Job title</th>
                  <th className="text-left font-medium px-3 py-2.5">Last login</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                  <th className="text-right font-medium px-5 py-2.5 w-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(u => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link to="/users/$id" params={{ id: u.id }} className="font-medium hover:text-info hover:underline">
                        {u.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3 w-3" /> {u.email}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{u.jobTitle || "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground tabular-nums">{u.lastLogin || "—"}</td>
                    <td className="px-3 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-5 py-3 text-right relative">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setMenuFor(menuFor === u.id ? null : u.id); }}
                        className="h-8 w-8 inline-grid place-items-center rounded-md hover:bg-accent/40"
                        aria-label={`Actions for ${u.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuFor === u.id && (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="absolute right-5 top-10 z-10 w-52 rounded-md border bg-popover shadow-lg py-1 text-left"
                        >
                          <MenuItem onClick={() => { setMenuFor(null); navigate({ to: "/users/$id", params: { id: u.id } }); }}>
                            Edit user
                          </MenuItem>
                          {u.status === "Active" ? (
                            <MenuItem onClick={() => { usersStore.setStatus(u.id, "Inactive"); toast.success(`${u.name} deactivated`); setMenuFor(null); }}>
                              <UserX className="h-4 w-4" /> Deactivate
                            </MenuItem>
                          ) : (
                            <MenuItem onClick={() => { usersStore.setStatus(u.id, "Active"); toast.success(`${u.name} reactivated`); setMenuFor(null); }}>
                              <UserCheck className="h-4 w-4" /> Reactivate
                            </MenuItem>
                          )}
                          <MenuItem danger onClick={() => { setMenuFor(null); setConfirmDel(u.id); }}>
                            <Trash2 className="h-4 w-4" /> Delete user
                          </MenuItem>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setConfirmDel(null)}>
          <div className="bg-card rounded-lg max-w-md w-full p-6 border" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg">Delete {target.name}?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This permanently removes the account and revokes platform access. This action cannot be undone.
              Consider deactivating the user instead.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  usersStore.remove(target.id);
                  toast.success(`${target.name} deleted`);
                  setConfirmDel(null);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete user
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

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGE[role]}`}>
      {role}
    </span>
  );
}
