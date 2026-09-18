import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtGBP } from "@/lib/data";
import { cn } from "@/lib/utils";

export type RateApprovalQueueLine = {
  itemId: string;
  productName: string;
  quantity: number;
  timeSlotName?: string | null;
  /** Persisted rate (usually the cap while pending). */
  rate: number;
  proposedRate?: number | null;
  rateReviewReason?: string | null;
  operativeName?: string | null;
};

type TaskRateApprovalSectionsProps = {
  pending: RateApprovalQueueLine[];
  rejected: RateApprovalQueueLine[];
  disabled?: boolean;
  updatingItemId?: string | null;
  onResubmitRejected: (line: RateApprovalQueueLine, nextRate: number) => void;
  className?: string;
};

/** Pending / Rejected rate-approval queues (visible to users who can see rates). */
export function TaskRateApprovalSections({
  pending,
  rejected,
  disabled = false,
  updatingItemId = null,
  onResubmitRejected,
  className,
}: TaskRateApprovalSectionsProps) {
  if (pending.length === 0 && rejected.length === 0) return null;

  return (
    <div className={cn("flex flex-col border-b border-border", className)}>
      {pending.length > 0 ? (
        <section className="border-b border-border/60 last:border-b-0">
          <div className="px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Pending for approval
            </p>
          </div>
          <ul className="space-y-1 px-3 pb-2">
            {pending.map((line) => {
              const detail = [
                line.operativeName,
                `Qty ${line.quantity}`,
                line.timeSlotName || null,
                line.proposedRate != null
                  ? `Proposed ${fmtGBP(line.proposedRate)}`
                  : null,
                `At cap ${fmtGBP(line.rate)}`,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li
                  key={line.itemId}
                  className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5"
                >
                  <AppTooltip
                    content={
                      <div className="space-y-0.5">
                        <p className="font-medium">{line.productName}</p>
                        <p className="font-normal text-muted-foreground">{detail}</p>
                      </div>
                    }
                    asChild
                    align="start"
                    contentClassName="max-w-sm"
                  >
                    <div className="min-w-0 cursor-default">
                      <p className="truncate text-sm font-medium">{line.productName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
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
              Rejected tasks
            </p>
          </div>
          <ul className="space-y-2 px-3 pb-2">
            {rejected.map((line) => (
              <RejectedRateLine
                key={line.itemId}
                line={line}
                disabled={disabled}
                updating={updatingItemId === line.itemId}
                onResubmit={onResubmitRejected}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RejectedRateLine({
  line,
  disabled,
  updating,
  onResubmit,
}: {
  line: RateApprovalQueueLine;
  disabled: boolean;
  updating: boolean;
  onResubmit: (line: RateApprovalQueueLine, nextRate: number) => void;
}) {
  const [rateDraft, setRateDraft] = useState(
    String(line.proposedRate ?? line.rate ?? ""),
  );

  const reason = line.rateReviewReason?.trim() || "No rejection reason provided";

  return (
    <li className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5">
      <AppTooltip content={reason} asChild align="start">
        <div className="min-w-0 cursor-default">
          <p className="truncate text-sm font-medium">{line.productName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {[
              line.operativeName,
              `Qty ${line.quantity}`,
              line.timeSlotName || null,
              line.proposedRate != null
                ? `Rejected ${fmtGBP(line.proposedRate)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-destructive/90">
            Hover for rejection reason
          </p>
        </div>
      </AppTooltip>
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={rateDraft}
          onChange={(e) => setRateDraft(e.target.value)}
          className="h-7 flex-1 text-xs"
          disabled={disabled || updating}
          aria-label={`Update rate for ${line.productName}`}
        />
        <Button
          type="button"
          size="sm"
          className="h-7 shrink-0 px-2 text-[11px]"
          disabled={disabled || updating || !String(rateDraft).trim()}
          onClick={() => {
            const next = Number(rateDraft);
            if (!Number.isFinite(next) || next < 0) return;
            onResubmit(line, next);
          }}
        >
          {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resubmit"}
        </Button>
      </div>
    </li>
  );
}
