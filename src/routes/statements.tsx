import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { wageSheets, operatives, fmtGBP } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/statements")({
  head: () => ({ meta: [{ title: "Statement Approval — Schore" }] }),
  component: Statements,
});

type S = "Pending" | "Accepted" | "Refused";

function Statements() {
  const [state, setState] = useState<Record<string, { status: S; reason?: string; date?: string }>>(
    Object.fromEntries(wageSheets.map(w => [w.id, {
      status: w.status === "Approved" ? "Accepted" : w.status === "Refused" ? "Refused" : "Pending",
      reason: w.status === "Refused" ? "Cost split disputed" : undefined,
      date: w.status !== "Pending" ? "2026-01-24" : undefined,
    }]))
  );
  const [sending, setSending] = useState<string | null>(null);

  const send = async (id: string) => {
    setSending(id);
    await new Promise(r => setTimeout(r, 500));
    setSending(null);
    toast.success("Statement emailed to operative");
  };

  const accept = (id: string) => { setState(s => ({...s, [id]: { status: "Accepted", date: new Date().toISOString().slice(0,10) }})); toast.success("Statement accepted"); };
  const refuse = (id: string) => {
    const reason = prompt("Refusal reason?");
    if (!reason) return;
    setState(s => ({...s, [id]: { status: "Refused", reason, date: new Date().toISOString().slice(0,10) }}));
    toast.error("Statement refused", { description: reason });
  };

  return (
    <div>
      <PageHeader title="Statement Approval" subtitle="Operatives review their wage statement and accept or refuse it." />
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Statement ID</th>
              <th className="px-3 py-3 text-left">Operative</th>
              <th className="px-3 py-3 text-left">Week</th>
              <th className="px-3 py-3 text-right">Net</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Response date</th>
              <th className="px-3 py-3 text-left">Refusal reason</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {wageSheets.map(w => {
              const o = operatives.find(x => x.id === w.operativeId);
              const st = state[w.id];
              return (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3"><code className="text-xs font-mono">{w.invoiceNo}</code></td>
                  <td className="px-3 py-3 font-medium">{o?.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">WE {w.weekEnding}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtGBP(w.net)}</td>
                  <td className="px-3 py-3"><StatusBadge status={st.status === "Accepted" ? "Approved" : st.status === "Refused" ? "Refused" : "Pending"} /></td>
                  <td className="px-3 py-3 text-muted-foreground">{st.date ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{st.reason ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="outline" size="sm" disabled={sending===w.id} onClick={()=>send(w.id)}>
                        {sending===w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}Send
                      </Button>
                      {st.status === "Pending" && <>
                        <button onClick={()=>accept(w.id)} aria-label="Accept" className="h-8 w-8 grid place-items-center rounded-md text-success hover:bg-success/10"><CheckCircle2 className="h-4 w-4" /></button>
                        <button onClick={()=>refuse(w.id)} aria-label="Refuse" className="h-8 w-8 grid place-items-center rounded-md text-destructive hover:bg-destructive/10"><XCircle className="h-4 w-4" /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
