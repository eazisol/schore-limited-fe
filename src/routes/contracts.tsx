import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { contracts, properties, fmtGBP } from "@/lib/data";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/contracts")({
  head: () => ({ meta: [{ title: "Contracts & Budgets | Schore" }] }),
  component: Contracts,
});

function Contracts() {
  return (
    <div>
      <PageHeader title="Contracts & Budgets" subtitle="Per-contract spend, prelims and properties · MS and John kept separate end-to-end" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {contracts.map(c => {
          const pct = Math.round(c.spent / c.budget * 100);
          const remaining = c.budget - c.spent;
          const contractProps = properties.filter(p => p.contract === c.id);
          return (
            <div key={c.id} className="card-elevated p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold">{c.client}</h2>
                    <p className="text-xs text-muted-foreground">{c.site} · {contractProps.length} properties</p>
                  </div>
                </div>
                <code className="text-sm font-mono px-2.5 py-1 rounded bg-secondary">{c.id}</code>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Productive spend</span>
                  <span className="font-mono tabular-nums">{fmtGBP(c.spent - c.prelims)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prelims (Storeman / Driver / SM / PM)</span>
                  <span className="font-mono tabular-nums">{fmtGBP(c.prelims)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-medium">
                  <span>Total spent</span>
                  <span className="font-mono tabular-nums">{fmtGBP(c.spent)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-mono tabular-nums">{fmtGBP(c.budget)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Remaining</span>
                  <span className={`font-mono tabular-nums ${remaining < 0 ? "text-destructive" : "text-success"}`}>{fmtGBP(remaining)}</span>
                </div>

                <div className="mt-4">
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full ${pct > 90 ? "bg-destructive" : "bg-accent"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{pct}% spent</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
