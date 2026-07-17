import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { wageSheets, getOperative, fmtGBP } from "@/lib/data";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/wages/")({
  head: () => ({ meta: [{ title: "Wage Sheets | Schore" }] }),
  component: WagesList,
});

function WagesList() {
  const [contract, setContract] = useState("All");
  const [status, setStatus] = useState("All");

  const rows = wageSheets.filter(w =>
    (contract === "All" || w.contract === contract) &&
    (status === "All" || w.status === status)
  );

  const totals = rows.reduce((acc, w) => ({
    gross: acc.gross + w.gross, cis: acc.cis + w.cisTax, net: acc.net + w.net
  }), { gross: 0, cis: 0, net: 0 });

  return (
    <div>
      <PageHeader
        title="Wage Sheets"
        subtitle="Week ending Friday 23/01/2026 · One sheet per operative, per contract"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast.success("Exporting MS wage sheets", { description: "CSV will download shortly." })}><Download className="h-4 w-4" />Export all (MS)</Button>
            <Button variant="outline" size="sm" onClick={() => toast.success("Exporting John wage sheets", { description: "CSV will download shortly." })}><Download className="h-4 w-4" />Export all (John)</Button>
            <Button size="sm" onClick={() => { const n = rows.filter(r => r.status === "Approved").length; if (n === 0) { toast.error("No approved sheets to send"); } else { toast.success(`Sent ${n} approved sheets`, { description: "Statements emailed to operatives." }); } }}><Send className="h-4 w-4" />Send approved</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Tot label="Gross" value={fmtGBP(totals.gross)} />
        <Tot label="CIS deducted" value={fmtGBP(totals.cis)} />
        <Tot label="Net pay" value={fmtGBP(totals.net)} accent />
      </div>

      <div className="card-elevated">
        <div className="p-4 border-b flex flex-wrap gap-3">
          <select value={contract} onChange={e=>setContract(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {["All","MS","John"].map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {["All","Draft","Pending","Approved","Refused","Paid"].map(s=><option key={s}>{s}</option>)}
          </select>
          <div className="ml-auto text-xs text-muted-foreground self-center">{rows.length} sheets</div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-5 py-2.5">Invoice</th>
              <th className="text-left font-medium px-3 py-2.5">Operative</th>
              <th className="text-left font-medium px-3 py-2.5">Contract</th>
              <th className="text-left font-medium px-3 py-2.5">Week Ending</th>
              <th className="text-right font-medium px-3 py-2.5">Gross</th>
              <th className="text-right font-medium px-3 py-2.5">CIS</th>
              <th className="text-right font-medium px-3 py-2.5">Net</th>
              <th className="text-left font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(w => {
              const op = getOperative(w.operativeId);
              return (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3"><Link to="/wages/$id" params={{ id: w.id }} className="font-mono text-xs font-medium hover:text-info hover:underline">{w.invoiceNo}</Link></td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{op?.name}</div>
                    <div className="text-[11px] text-muted-foreground">{op?.trade}</div>
                  </td>
                  <td className="px-3 py-3"><code className="text-xs font-mono">{w.contract}</code></td>
                  <td className="px-3 py-3">{w.weekEnding}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(w.gross)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-destructive">−{fmtGBP(w.cisTax)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">{fmtGBP(w.net)}</td>
                  <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No wage sheets for this filter.</div>}
      </div>
    </div>
  );
}

function Tot({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card-elevated p-4 ${accent ? "border-accent/40 bg-accent/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-display font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
