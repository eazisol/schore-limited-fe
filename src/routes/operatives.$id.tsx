import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { operatives, wageSheets, allocations, getOperative, getProperty, fmtGBP } from "@/lib/data";
import { Edit, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/operatives/$id")({
  loader: ({ params }) => {
    const op = getOperative(params.id);
    if (!op) throw notFound();
    return { op };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.op.name ?? "Operative"} | Schore` }] }),
  notFoundComponent: () => (
    <div className="card-elevated p-12 text-center">
      <h2 className="font-display font-semibold text-lg">Operative not found</h2>
      <p className="text-sm text-muted-foreground mt-1">This record may have been removed.</p>
      <Button className="mt-4" asChild><Link to="/operatives">Back to operatives</Link></Button>
    </div>
  ),
  component: OperativeDetail,
});

function OperativeDetail() {
  const { op } = Route.useLoaderData();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [form, setForm] = useState(op);

  const opAllocs = allocations.filter(a => a.operativeId === op.id);
  const opWages = wageSheets.filter(w => w.operativeId === op.id);
  const totalEarned = opWages.reduce((s, w) => s + w.net, 0);

  return (
    <div className="space-y-6">
      <Link to="/operatives" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All operatives
      </Link>

      <PageHeader
        title={op.name}
        subtitle={`${op.trade} · CIS ${op.cis} · ${fmtGBP(op.dailyRate)}/day`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              <Edit className="h-4 w-4" /> {editing ? "Cancel edit" : "Edit"}
            </Button>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-elevated p-6">
            <h3 className="font-display font-semibold mb-4">Profile</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {(["name","trade","cis","dailyRate","phone","utr","startDate","status"] as const).map(k => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground capitalize">{k === "dailyRate" ? "Daily Rate" : k === "utr" ? "UTR" : k === "cis" ? "CIS" : k}</dt>
                  {editing ? (
                    <input
                      className="input mt-1"
                      value={String((form as any)[k])}
                      onChange={e => setForm({ ...form, [k]: e.target.value } as typeof form)}
                    />
                  ) : (
                    <dd className="font-medium mt-0.5">
                      {k === "dailyRate" ? fmtGBP(op.dailyRate) : k === "status" ? <StatusBadge status={op.status} /> : (op as any)[k] || "—"}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
            {editing && (
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => { setForm(op); setEditing(false); }}>Cancel</Button>
                <Button onClick={() => { toast.success("Profile updated"); setEditing(false); }}>Save changes</Button>
              </div>
            )}
          </div>

          <div className="card-elevated">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold">Recent allocations</h3>
              <p className="text-xs text-muted-foreground">From the Master · ticked work feeds the wage sheet.</p>
            </div>
            {opAllocs.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No allocations this week.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-5 py-2.5">Date</th>
                      <th className="text-left font-medium px-3 py-2.5">Property</th>
                      <th className="text-left font-medium px-3 py-2.5">Code</th>
                      <th className="text-right font-medium px-5 py-2.5">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {opAllocs.map(a => {
                      const p = getProperty(a.propertyId);
                      return (
                        <tr key={a.id}>
                          <td className="px-5 py-3">{a.date}</td>
                          <td className="px-3 py-3">{p?.ref} <span className="text-muted-foreground text-xs">· {p?.contract}</span></td>
                          <td className="px-3 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{a.code}</code></td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums">{fmtGBP(a.value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-elevated p-6">
            <h3 className="font-display font-semibold mb-4">Earnings summary</h3>
            <div className="space-y-3">
              <Stat label="Net paid YTD" value={fmtGBP(totalEarned)} />
              <Stat label="Wage sheets" value={String(opWages.length)} />
              <Stat label="Allocations this week" value={String(opAllocs.length)} />
            </div>
          </div>
          <div className="card-elevated p-6">
            <h3 className="font-display font-semibold mb-3">Wage sheets</h3>
            {opWages.length === 0 ? (
              <p className="text-xs text-muted-foreground">No wage sheets yet.</p>
            ) : (
              <ul className="space-y-2">
                {opWages.map(w => (
                  <li key={w.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <Link to="/wages/$id" params={{ id: w.id }} className="text-sm font-medium hover:underline">
                        W/E {w.weekEnding} · {w.contract}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{fmtGBP(w.net)} net</div>
                    </div>
                    <StatusBadge status={w.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full p-6 border">
            <h3 className="font-display font-semibold text-lg">Delete {op.name}?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This will remove the operative from the workforce builder. Past wage sheets and allocations are kept for audit.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setConfirmDel(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { toast.success(`${op.name} deleted`); navigate({ to: "/operatives" }); }}>
                Delete operative
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-display font-semibold tabular-nums">{value}</span>
    </div>
  );
}
