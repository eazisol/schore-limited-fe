import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { wageSheets, operatives, fmtGBP } from "@/lib/data";

export const Route = createFileRoute("/payroll")({
  head: () => ({ meta: [{ title: "Payroll Engine — Schore" }] }),
  component: Payroll,
});

function Payroll() {
  const [weekEnding, setWeek] = useState("2026-01-23");
  const [contract, setContract] = useState<"All" | "MS" | "John">("All");
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);

  const rows = wageSheets.filter(w => (contract === "All" || w.contract === contract) && w.weekEnding === weekEnding);
  const totals = rows.reduce((s, r) => ({ gross: s.gross + r.gross, cis: s.cis + r.cisTax, net: s.net + r.net }), { gross: 0, cis: 0, net: 0 });

  const run = async () => {
    setRunning(true);
    await new Promise(r => setTimeout(r, 1100));
    setRunning(false);
    setRan(true);
    toast.success(`Payroll generated — ${rows.length} operative(s)`, { description: `Engine used MAX(price work, daily rate). Gross ${fmtGBP(totals.gross)}.` });
  };

  return (
    <div>
      <PageHeader
        title="Payroll Engine"
        subtitle="Weekly run · MAX(price work, daily rate) with CIS deduction."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!ran} onClick={() => toast.success("Exported CIS report (PDF)")}><Download className="h-4 w-4" />CIS Report</Button>
            <Button size="sm" onClick={run} disabled={running}>{running ? <><Loader2 className="h-4 w-4 animate-spin" />Running…</> : <><Play className="h-4 w-4" />Run payroll</>}</Button>
          </div>
        }
      />

      <div className="card-elevated mb-6 p-4 flex flex-wrap gap-3">
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Week ending</span>
          <input type="date" value={weekEnding} onChange={e=>setWeek(e.target.value)} className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Contract</span>
          <select value={contract} onChange={e=>setContract(e.target.value as any)} className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option>All</option><option value="MS">MS</option><option value="John">John</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card-elevated p-5"><div className="text-xs text-muted-foreground">Gross pay</div><div className="text-2xl font-display font-semibold font-mono">{fmtGBP(totals.gross)}</div></div>
        <div className="card-elevated p-5"><div className="text-xs text-muted-foreground">CIS deduction</div><div className="text-2xl font-display font-semibold font-mono text-warning-foreground">{fmtGBP(totals.cis)}</div></div>
        <div className="card-elevated p-5"><div className="text-xs text-muted-foreground">Net to pay</div><div className="text-2xl font-display font-semibold font-mono text-success">{fmtGBP(totals.net)}</div></div>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr><th className="px-5 py-3 text-left">Operative</th><th className="px-3 py-3 text-left">Contract</th><th className="px-3 py-3 text-right">Gross</th><th className="px-3 py-3 text-right">CIS %</th><th className="px-3 py-3 text-right">CIS Tax</th><th className="px-3 py-3 text-right">Net</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(w => {
              const o = operatives.find(x => x.id === w.operativeId);
              return (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{o?.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{w.contract}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(w.gross)}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{w.cisRate}%</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(w.cisTax)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-medium">{fmtGBP(w.net)}</td>
                  <td className="px-5 py-3 text-right"><Link to="/wages/$id" params={{id:w.id}} search={{ from: "payroll" }} className="text-xs text-info hover:underline">View sheet</Link></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">No wage sheets for this week / contract.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
