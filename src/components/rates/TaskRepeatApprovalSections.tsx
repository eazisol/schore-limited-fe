import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtGBP } from "@/lib/data";
import { cn } from "@/lib/utils";

export type RepeatApprovalQueueLine = {
  id: string;
  kind: string;
  tradeGroupId?: string | null;
  productId?: string | null;
  itemLabel: string;
  operativeId: string;
  operativeName: string;
  workDate: string;
  rate: number;
  quantity: number;
  timeSlotId?: string | null;
  timeSlotName?: string | null;
  applyRatePermanently?: boolean;
  reason: string;
  rateReason?: string | null;
  statusCode: string;
  reviewReason?: string | null;
};

type TaskRepeatApprovalSectionsProps = {
  pending: RepeatApprovalQueueLine[];
  rejected: RepeatApprovalQueueLine[];
  disabled?: boolean;
  updatingId?: string | null;
  onResubmitRejected: (line: RepeatApprovalQueueLine, reason: string) => void;
  className?: string;
};

/** Pending / Rejected repeat-task approval queues in assign UIs. */
export function TaskRepeatApprovalSections({
  pending,
  rejected,
  disabled = false,
  updatingId = null,
  onResubmitRejected,
  className,
}: TaskRepeatApprovalSectionsProps) {
  if (pending.length === 0 && rejected.length === 0) return null;

  return (
    <div className={cn("flex flex-col border-b border-border", className)}>
      {pending.length > 0 ? (
        <section className="border-b border-border/60 last:border-b-0">
          <div className="px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Pending repeat approval
            </p>
          </div>
          <ul className="space-y-1 px-3 pb-2">
            {pending.map((line) => {
              const detail = [
                line.operativeName,
                `Qty ${line.quantity}`,
                line.timeSlotName || null,
                line.rate > 0 ? fmtGBP(line.rate) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              const reason = line.reason?.trim() || "No repeat reason provided";

              return (
                <li
                  key={line.id}
                  className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5"
                >
                  <AppTooltip
                    content={
                      <div className="space-y-0.5">
                        <p className="font-medium">{line.itemLabel}</p>
                        <p className="font-normal text-muted-foreground">{detail}</p>
                        <p className="font-normal text-muted-foreground">Reason: {reason}</p>
                      </div>
                    }
                    asChild
                    align="start"
                    contentClassName="max-w-sm"
                  >
                    <div className="min-w-0 cursor-default">
                      <p className="truncate text-sm font-medium">{line.itemLabel}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
                      <p className="mt-0.5 truncate text-[10px] text-amber-800/80 dark:text-amber-300/80">
                        Hover for repeat reason
                      </p>
                    </div>
                  </AppTooltip>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {rejected.length > 0 ? (
        <section>
          <div className="px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-destructive">
              Rejected repeat tasks
            </p>
          </div>
          <ul className="space-y-2 px-3 pb-2">
            {rejected.map((line) => (
              <RejectedRepeatLine
                key={line.id}
                line={line}
                disabled={disabled}
                updating={updatingId === line.id}
                onResubmit={onResubmitRejected}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RejectedRepeatLine({
  line,
  disabled,
  updating,
  onResubmit,
}: {
  line: RepeatApprovalQueueLine;
  disabled: boolean;
  updating: boolean;
  onResubmit: (line: RepeatApprovalQueueLine, reason: string) => void;
}) {
  const [reasonDraft, setReasonDraft] = useState(line.reason ?? "");
  const reviewReason = line.reviewReason?.trim() || "No rejection reason provided";

  return (
    <li className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5">
      <AppTooltip content={reviewReason} asChild align="start">
        <div className="min-w-0 cursor-default">
          <p className="truncate text-sm font-medium">{line.itemLabel}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {[
              line.operativeName,
              `Qty ${line.quantity}`,
              line.timeSlotName || null,
              line.rate > 0 ? fmtGBP(line.rate) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-destructive/90">
            Hover for rejection reason
          </p>
        </div>
      </AppTooltip>
      <Textarea
        value={reasonDraft}
        onChange={(e) => setReasonDraft(e.target.value)}
        placeholder="Update repeat reason…"
        className="mt-1.5 min-h-[52px] text-xs"
        disabled={disabled || updating}
        aria-label={`Repeat reason for ${line.itemLabel}`}
      />
      <div className="mt-1.5 flex justify-end">
        <Button
          type="button"
          size="sm"
          className="h-7 shrink-0 px-2 text-[11px]"
          disabled={disabled || updating || !reasonDraft.trim()}
          onClick={() => onResubmit(line, reasonDraft.trim())}
        >
          {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resubmit"}
        </Button>
      </div>
    </li>
  );
}
