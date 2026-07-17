import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { getWageSheet, getOperative, fmtGBPp } from "@/lib/data";
import { ArrowLeft, Send, Download, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/wages/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ from: s.from === "payroll" ? "payroll" : undefined }) as { from?: "payroll" },
  loader: ({ params }) => {
    const w = getWageSheet(params.id);
    if (!w) throw notFound();
    return { w };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `Wage Sheet ${loaderData?.w.invoiceNo ?? ""} | Schore` }] }),
  notFoundComponent: () => (
    <div className="card-elevated p-12 text-center">
      <h2 className="font-display font-semibold">Wage sheet not found</h2>
      <Button className="mt-4" asChild><Link to="/wages">All wage sheets</Link></Button>
    </div>
  ),
  component: WageSheetView,
});

function WageSheetView() {
  const { w } = Route.useLoaderData();
  const { from } = Route.useSearch();
  const op = getOperative(w.operativeId)!;
  const [confirmSend, setConfirmSend] = useState(false);
  const fromPayroll = from === "payroll";

  return (
    <div className="space-y-6">
      {fromPayroll ? (
        <Link to="/payroll" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Payroll Engine
        </Link>
      ) : (
        <Link to="/wages" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All wage sheets
        </Link>
      )}

      <PageHeader
        title={`Wage Sheet · ${w.invoiceNo}`}
        subtitle={`${op.name} · ${w.contract} · Week ending ${w.weekEnding}`}
        actions={
          <>
            <StatusBadge status={w.status} />
            <Button variant="outline" size="sm" onClick={() => toast.success("Generating PDF", { description: `${w.invoiceNo}.pdf will download shortly.` })}><Download className="h-4 w-4" />Download PDF</Button>
            {w.status === "Draft" && <Button size="sm" onClick={() => toast.success("Submitted for approval")}>Submit</Button>}
            {w.status === "Pending" && (
              <>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => toast(`${w.invoiceNo} returned to draft`, { description: "Operative notified." })}><X className="h-4 w-4" />Reject</Button>
                <Button size="sm" onClick={() => toast.success("Wage sheet approved")}><Check className="h-4 w-4" />Approve</Button>
              </>
            )}
            {w.status === "Approved" && <Button size="sm" onClick={() => setConfirmSend(true)}><Send className="h-4 w-4" />Send to operative</Button>}
          </>
        }
      />

      {/* Statement sheet — faithful to template */}
      <div className="card-elevated p-8 md:p-10 max-w-4xl">
        <div className="flex justify-between items-start pb-6 border-b">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">SCHORE LIMITED</h2>
            <p className="text-xs text-muted-foreground mt-1">Weekly Wage Sheet</p>
            <p className="text-[11px] text-muted-foreground">Construction & Maintenance — Basildon, Essex</p>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <div><span className="text-muted-foreground">Invoice No:</span> <strong className="font-mono">{w.invoiceNo}</strong></div>
            <div><span className="text-muted-foreground">Week ending:</span> <strong>{w.weekEnding}</strong></div>
            <div className="text-muted-foreground mt-2">Bill To: Schore Limited</div>
            <div className="text-muted-foreground">Unit E, The Business Center,</div>
            <div className="text-muted-foreground">Faringdon Ave, Romford RM3 8EN</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 text-sm border-b">
          <KV label="Name" value={op.name} />
          <KV label="Trade" value={op.trade} />
          <KV label="Site / Contract" value={`Basildon — ${w.contract}`} />
          <KV label="Site Manager" value="Claudiu Ceausu" />
          <KV label="UTR / NINO" value={op.utr || "—"} />
          <KV label="CIS rate" value={`${w.cisRate}%`} />
        </div>

        <h3 className="font-display font-semibold mt-6 mb-3">Work completed</h3>
        <table className="w-full text-sm">
          <thead className="border-y bg-muted/30 text-xs">
            <tr>
              <th className="text-left font-medium px-3 py-2">Property</th>
              <th className="text-left font-medium px-3 py-2">Date</th>
              <th className="text-left font-medium px-3 py-2">Task</th>
              <th className="text-right font-medium px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {w.lines.map((l: { property: string; date: string; task: string; amount: number }, i: number) => (
              <tr key={i}>
                <td className="px-3 py-2.5">{l.property}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{l.date}</td>
                <td className="px-3 py-2.5">{l.task}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtGBPp(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
          <Row k="Gross Pay" v={fmtGBPp(w.gross)} />
          <Row k="CIS Rate" v={`${w.cisRate}%`} />
          <Row k="CIS Tax" v={`−${fmtGBPp(w.cisTax)}`} muted />
          <div className="border-t pt-2">
            <Row k="Net Pay" v={fmtGBPp(w.net)} bold />
          </div>
        </div>

        <div className="mt-10 pt-6 border-t text-xs text-muted-foreground">
          <div className="mb-8">Signed: ______________________________</div>
          <p className="italic">Thank you for your business.</p>
          <p className="text-[10px] mt-1">One sheet per operative, per contract, per week. Each sheet self-contained.</p>
        </div>
      </div>

      {confirmSend && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full p-6 border">
            <h3 className="font-display font-semibold text-lg">Send statement to {op.name}?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              The operative will receive this statement and be asked to <strong>Accept</strong> or <strong>Refuse</strong> with a reason. The system exports nothing until you confirm.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setConfirmSend(false)}>Cancel</Button>
              <Button onClick={() => { toast.success(`Statement sent to ${op.name}`); setConfirmSend(false); }}>
                <Send className="h-4 w-4" />Send now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Row({ k, v, bold, muted }: { k: string; v: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{k}</span>
      <span className={`font-mono tabular-nums ${bold ? "font-bold text-lg" : ""}`}>{v}</span>
    </div>
  );
}
