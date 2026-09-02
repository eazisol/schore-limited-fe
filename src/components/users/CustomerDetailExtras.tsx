import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Eye, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { costBudgetService } from "@/lib/api/services/cost-budget";
import {
  DOCUMENT_TYPE_CODE,
  statusesService,
} from "@/lib/api/services/statuses";
import { tasksService } from "@/lib/api/services/tasks";
import { fmtGBP } from "@/lib/data";
import { IN_PROGRESS_STATUS_CODE } from "@/lib/hold";
import { cn } from "@/lib/utils";

export function CustomerCostBudgetCard({ customerId }: { customerId: number }) {
  const costQuery = useQuery({
    queryKey: ["users", customerId, "cost-budget"],
    queryFn: async () => (await costBudgetService.getForCustomer(customerId)).data,
    enabled: Boolean(customerId?.trim()),
  });

  const summary = useMemo(() => {
    const fromList = costQuery.data?.customers?.find((c) => c.customerId === customerId);
    if (fromList) return fromList;
    return {
      customerId,
      customerName: "",
      budget: costQuery.data?.totalBudget ?? 0,
      spent: costQuery.data?.totalSpent ?? 0,
      remaining: costQuery.data?.totalRemaining ?? 0,
      overBudgetTaskCount: costQuery.data?.overBudgetCount ?? 0,
    };
  }, [customerId, costQuery.data]);

  const pct =
    summary.budget > 0 ? Math.round((summary.spent / summary.budget) * 100) : 0;

  return (
    <div className="card-elevated p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">Cost &amp; budget</h3>
        {summary.overBudgetTaskCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {summary.overBudgetTaskCount} over budget
          </span>
        ) : null}
      </div>

      {costQuery.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading cost…
        </div>
      ) : costQuery.isError ? (
        <p className="py-4 text-sm text-muted-foreground">Unable to load cost &amp; budget.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-muted-foreground">Budget</div>
              <div className="font-mono tabular-nums">{fmtGBP(summary.budget)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Spent</div>
              <div className="font-mono tabular-nums">{fmtGBP(summary.spent)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Remaining</div>
              <div
                className={cn(
                  "font-mono tabular-nums",
                  summary.remaining < 0 ? "text-destructive" : "text-success",
                )}
              >
                {fmtGBP(summary.remaining)}
              </div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full transition-[width]",
                pct > 90 ? "bg-destructive" : "bg-accent",
              )}
              style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function CustomerRunningTasksCard({ customerId }: { customerId: number }) {
  const statusesQuery = useQuery({
    queryKey: ["statuses", "task", "options"],
    queryFn: async () =>
      (
        await statusesService.list({
          documentTypeCode: DOCUMENT_TYPE_CODE.TASK,
          pageSize: 50,
        })
      ).data,
    enabled: Boolean(customerId?.trim()),
  });

  const inProgressStatusId = useMemo(() => {
    const list = statusesQuery.data?.items ?? [];
    return list.find((s) => s.code === IN_PROGRESS_STATUS_CODE)?.id ?? null;
  }, [statusesQuery.data]);

  const tasksQuery = useQuery({
    queryKey: ["tasks", "customer-running", customerId, inProgressStatusId],
    queryFn: async () =>
      (
        await tasksService.list({
          page: 1,
          pageSize: 50,
          customerId,
          statusId: inProgressStatusId!,
          sortDir: "desc",
        })
      ).data,
    enabled: Boolean(customerId?.trim()) &&
      inProgressStatusId != null,
  });

  const runningTasks = tasksQuery.data?.items ?? [];

  return (
    // <div className="card-elevated overflow-hidden">
    //   <div className="border-b px-5 py-3 font-display text-base font-semibold tracking-tight">
    //     Current running jobs
    //   </div>

    //   {tasksQuery.isLoading || statusesQuery.isLoading ? (
    //     <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
    //       <Loader2 className="h-4 w-4 animate-spin" />
    //       Loading jobs…
    //     </div>
    //   ) : tasksQuery.isError || statusesQuery.isError ? (
    //     <p className="px-5 py-8 text-center text-sm text-muted-foreground">
    //       Unable to load running jobs.
    //     </p>
    //   ) : runningTasks.length === 0 ? (
    //     <p className="px-5 py-8 text-center text-sm text-muted-foreground">
    //       No in-progress jobs for this client.
    //     </p>
    //   ) : (
    //     <div className="overflow-x-auto">
    //       <table className="w-full text-sm">
    //         <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
    //           <tr>
    //             <th className="px-4 py-2.5 text-left font-medium">Job</th>
    //             <th className="px-3 py-2.5 text-left font-medium">Property</th>
    //             <th className="px-3 py-2.5 text-left font-medium">Status</th>
    //             <th className="px-4 py-2.5 text-right font-medium" />
    //           </tr>
    //         </thead>
    //         <tbody className="divide-y">
    //           {runningTasks.map((task) => (
    //             <tr key={task.id} className="hover:bg-muted/30">
    //               <td className="px-4 py-2.5 font-mono text-xs tabular-nums">
    //                 {task.taskNumber}
    //               </td>
    //               <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">
    //                 {task.propertyName}
    //               </td>
    //               <td className="px-3 py-2.5">
    //                 <StatusBadge status={task.statusName || task.statusCode} />
    //               </td>
    //               <td className="px-4 py-2.5 text-right">
    //                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
    //                   <Link
    //                     to="/tasks/$id"
    //                     params={{ id: String(task.id) }}
    //                     search={{
    //                       mode: "view",
    //                       from: "customer",
    //                       customerId: String(customerId),
    //                     }}
    //                     aria-label={`View ${task.taskNumber}`}
    //                   >
    //                     <Eye className="h-4 w-4" />
    //                   </Link>
    //                 </Button>
    //               </td>
    //             </tr>
    //           ))}
    //         </tbody>
    //       </table>
    //     </div>
    //   )}
    // </div>
    <div></div>
  );
}
