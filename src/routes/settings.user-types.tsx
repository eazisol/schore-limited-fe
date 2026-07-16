import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle, Eye, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { Form, TextField, CheckboxField, SubmitButton } from "@/components/form";
import { Can, usePathPermission } from "@/components/Permission";
import { userTypesService, type ApiUserType, type UserTypePayload } from "@/lib/api/services/system-config";
import { notifyApiError } from "@/lib/api/axios";

export const Route = createFileRoute("/settings/user-types")({
  head: () => ({ meta: [{ title: "User Types — Settings" }] }),
  component: UserTypesPage,
});

const listKey = ["settings", "user-types"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim().min(1, "Code is required"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Mode = { kind: "create" } | { kind: "edit"; item: ApiUserType } | { kind: "view"; item: ApiUserType };

function UserTypesPage() {
  const qc = useQueryClient();
  const canModify = usePathPermission("modify");
  const canDelete = usePathPermission("delete");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiUserType | null>(null);

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

  const query = useQuery({
    queryKey: [...listKey, { page, pageSize, search }],
    queryFn: async () => (await userTypesService.list({ page, pageSize, search })).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userTypesService.remove(id),
    onSuccess: () => {
      toast.success("User type deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: listKey });
    },
    onError: (err) => notifyApiError(err, "Failed to delete user type"),
  });

  return (
    <div>
      <div className="card-elevated">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background w-full sm:w-80">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by name or code…"
              className="bg-transparent text-sm outline-none w-full"
              aria-label="Search user types"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {query.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Can action="modify">
              <Button size="sm" onClick={() => setMode({ kind: "create" })}>
                <Plus className="h-4 w-4" /> Add user type
              </Button>
            </Can>
          </div>
        </div>

        {query.isLoading ? (
          <div className="p-12 grid place-items-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mb-2" />
            Loading user types…
          </div>
        ) : query.isError ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-5 w-5 mx-auto text-destructive mb-2" />
            <div className="text-sm font-medium">Unable to load user types</div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No user types found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Name</th>
                  <th className="text-left font-medium px-3 py-2.5">Code</th>
                  <th className="text-left font-medium px-3 py-2.5 w-24">Status</th>
                  <th className="text-right font-medium px-5 py-2.5 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.code}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${r.isActive ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                        {r.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <IconBtn label="View" onClick={() => setMode({ kind: "view", item: r })}><Eye className="h-4 w-4" /></IconBtn>
                        {canModify && (
                          <IconBtn label="Edit" onClick={() => setMode({ kind: "edit", item: r })}><Pencil className="h-4 w-4" /></IconBtn>
                        )}
                        {canDelete && (
                          <IconBtn label="Delete" danger onClick={() => setConfirmDel(r)}><Trash2 className="h-4 w-4" /></IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
            itemLabel="user types"
            disabled={query.isFetching}
          />
        )}
      </div>

      {mode && (
        <UserTypeFormModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => { setMode(null); qc.invalidateQueries({ queryKey: listKey }); }}
        />
      )}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setConfirmDel(null)}>
          <div className="bg-card rounded-lg max-w-md w-full p-6 border" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg">Delete user type “{confirmDel.name}”?</h3>
            <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setConfirmDel(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDel.id)}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
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

function UserTypeFormModal({ mode, onClose, onSaved }: { mode: Mode; onClose: () => void; onSaved: () => void }) {
  const isView = mode.kind === "view";
  const existing = mode.kind === "create" ? null : mode.item;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      code: existing?.code ?? "",
      isActive: existing?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: UserTypePayload) => {
      if (mode.kind === "edit") return userTypesService.update(mode.item.id, payload);
      return userTypesService.create(payload);
    },
    onSuccess: res => {
      toast.success(res.message || (mode.kind === "edit" ? "User type updated" : "User type created"));
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save user type"),
  });

  async function submit(v: Values) {
    await mutation.mutateAsync({
      name: v.name.trim(),
      code: v.code.trim(),
      isActive: v.isActive,
    });
  }

  const title = mode.kind === "create" ? "Add user type" : mode.kind === "edit" ? "Edit user type" : "View user type";

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <Form form={form} onSubmit={submit} className="space-y-4">
        <fieldset disabled={isView} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField<Values> name="name" label="Name" required autoFocus={!isView} />
            <TextField<Values> name="code" label="Code" required />
          </div>
          <CheckboxField<Values> name="isActive" label="Active" />
        </fieldset>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>{isView ? "Close" : "Cancel"}</Button>
          {!isView && (
            <SubmitButton loadingText="Saving…">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {mode.kind === "edit" ? "Update user type" : "Create user type"}
            </SubmitButton>
          )}
        </div>
      </Form>
    </Modal>
  );
}
