import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileSpreadsheet, FileText, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports & Exports | Schore" }] }),
  component: Reports,
});

const groups: { title: string; items: { id: string; name: string; description: string }[] }[] = [
  {
    title: "Payroll Reports",
    items: [
      { id: "wp",  name: "Weekly Payroll",      description: "Per-operative gross/CIS/net for a week ending." },
      { id: "cis", name: "CIS Report",          description: "HMRC-style monthly CIS deductions summary." },
      { id: "os",  name: "Operative Summary",   description: "12-week earnings rollup by operative." },
    ],
  },
  {
    title: "Cost Reports",
    items: [
      { id: "msc", name: "MS Contract Cost Report",   description: "All productive + prelim spend on MS." },
      { id: "jc",  name: "John Contract Cost Report", description: "All productive + prelim spend on John." },
      { id: "bv",  name: "Budget Variance Report",    description: "Properties over budget with deltas." },
    ],
  },
  {
    title: "KPI Reports",
    items: [
      { id: "pd",  name: "Property Duration Report", description: "Days on site vs target by type (KBWC, Kitchen…)." },
      { id: "hr",  name: "Hold Reason Report",       description: "Aggregated hold reasons & lost days." },
      { id: "dr",  name: "Delay Report",             description: "Properties exceeding target duration." },
    ],
  },
];

function Reports() {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, format: "xlsx" | "pdf" | "email") => {
    setBusy(id + format);
    await new Promise(r => setTimeout(r, 700));
    setBusy(null);
    if (format === "email") toast.success("Report emailed to your inbox");
    else toast.success(`Exported (${format.toUpperCase()})`);
  };

  return (
    <div>
      <PageHeader title="Reports & Exports" subtitle="Generate payroll, cost and KPI reports. Export to Excel, PDF, or email." />
      <div className="space-y-6">
        {groups.map(g => (
          <div key={g.title} className="card-elevated overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">{g.title}</div>
            <div className="divide-y">
              {g.items.map(it => (
                <div key={it.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.description}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={busy===it.id+"xlsx"} onClick={()=>run(it.id,"xlsx")}>
                      {busy===it.id+"xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}Excel
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy===it.id+"pdf"} onClick={()=>run(it.id,"pdf")}>
                      {busy===it.id+"pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}PDF
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy===it.id+"email"} onClick={()=>run(it.id,"email")}>
                      {busy===it.id+"email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}Email
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
