import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { getProperty, allocations, getOperative, fmtGBP, holdReasons } from "@/lib/data";
import { ArrowLeft, MapPin, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/properties/$id")({
  loader: ({ params }) => {
    const p = getProperty(params.id);
    if (!p) throw notFound();
    return { p };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.p.ref ?? "Property"} — Schore` }] }),
  notFoundComponent: () => (
    <div className="card-elevated p-12 text-center">
      <h2 className="font-display font-semibold">Property not found</h2>
      <Button className="mt-4" asChild><Link to="/properties">All properties</Link></Button>
    </div>
  ),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { p } = Route.useLoaderData();
  const allocs = allocations.filter(a => a.propertyId === p.id);
  const pct = Math.round(p.spent / p.budget * 100);
  const remaining = p.budget - p.spent;
  const kpiDays = p.daysOnSite - p.heldDays;
  const kpiTarget = p.type === "KBWC" ? 15 : p.type === "Kitchen" ? 11 : 9;

  return (
    <div className="space-y-6">
      <Link to="/properties" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All properties
      </Link>

      <PageHeader
        title={p.ref}
        subtitle={`${p.address} · ${p.postcode}`}
        actions={
          <>
            <StatusBadge status={p.status} />
            <Button variant="outline" size="sm">Edit property</Button>
            <Button size="sm">Hand over</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Mini label="Contract" value={p.contract} />
            <Mini label="Type" value={p.type} />
            <Mini label="Days on site" value={`${p.daysOnSite}`} hint={`${p.heldDays} held`} />
            <Mini label="KPI clock" value={`${kpiDays}/${kpiTarget}`} hint={kpiDays > kpiTarget ? "Over target" : "On target"} tone={kpiDays > kpiTarget ? "warn" : "ok"} />
          </div>

          {/* Budget */}
          <div className="card-elevated p-6">
            <div className="flex justify-between items-baseline mb-3">
              <h3 className="font-display font-semibold">Cost vs Budget</h3>
              <span className={`text-xs ${pct > 90 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {pct}% spent · {fmtGBP(remaining)} remaining
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : "bg-accent"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Spent</div><div className="font-mono tabular-nums">{fmtGBP(p.spent)}</div></div>
              <div><div className="text-xs text-muted-foreground">Budget</div><div className="font-mono tabular-nums">{fmtGBP(p.budget)}</div></div>
              <div><div className="text-xs text-muted-foreground">Remaining</div><div className={`font-mono tabular-nums ${remaining < 0 ? "text-destructive" : ""}`}>{fmtGBP(remaining)}</div></div>
            </div>
            {pct > 90 && (
              <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex gap-2 text-xs">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <span>This property is approaching budget. Review allocations before further work.</span>
              </div>
            )}
          </div>

          {/* Allocations */}
          <div className="card-elevated">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold">Work history</h3>
              <p className="text-xs text-muted-foreground">All ticked work on this property — feeds wage sheets.</p>
            </div>
            {allocs.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No allocations recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-5 py-2.5">Date</th>
                    <th className="text-left font-medium px-3 py-2.5">Operative</th>
                    <th className="text-left font-medium px-3 py-2.5">Task</th>
                    <th className="text-right font-medium px-5 py-2.5">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allocs.map(a => {
                    const op = getOperative(a.operativeId);
                    return (
                      <tr key={a.id}>
                        <td className="px-5 py-3">{a.date}</td>
                        <td className="px-3 py-3">{op?.name}</td>
                        <td className="px-3 py-3">{a.description} <code className="text-[10px] font-mono ml-1 text-muted-foreground">{a.code}</code></td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">{fmtGBP(a.value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-elevated p-6">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" /> Access</h3>
            <p className="text-sm">{p.accessNotes || <span className="text-muted-foreground">No access notes.</span>}</p>
            <div className="mt-4 text-xs text-muted-foreground">Site Manager</div>
            <div className="text-sm font-medium">{p.siteManager}</div>
          </div>

          {p.status === "On Hold" && (
            <div className="card-elevated p-6 border-warning/30">
              <h3 className="font-display font-semibold mb-2">Hold reason</h3>
              <p className="text-sm">{holdReasons[1]}</p>
              <p className="text-xs text-muted-foreground mt-2">Day not counted toward KPI · timestamped for delay claim</p>
              <Button variant="outline" size="sm" className="mt-4">Lift hold</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="card-elevated p-4">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-display font-semibold mt-1">{value}</div>
      {hint && <div className={`text-[11px] mt-0.5 ${tone === "warn" ? "text-destructive" : "text-muted-foreground"}`}>{hint}</div>}
    </div>
  );
}
