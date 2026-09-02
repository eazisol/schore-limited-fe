import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AppTooltip } from "@/components/AppTooltip";
import {
  dailyProgrammeService,
  type ApiDailyAssignedItemLine,
  type ApiDailyNameOperative,
  type ApiDailyProgramme,
  type ApiDailyRow,
} from "@/lib/api/services/daily-programme";
import { dailyQueryKey } from "@/routes/daily";
import { notifyApiError } from "@/lib/api/axios";
import { fmtGBP } from "@/lib/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DailyNameCellProps = {
  row: ApiDailyRow;
  date: string;
  disabled?: boolean;
};

function mergeRowInCache(
  qc: ReturnType<typeof useQueryClient>,
  taskId: number,
  updatedRow: ApiDailyRow,
) {
  qc.setQueriesData<ApiDailyProgramme>({ queryKey: dailyQueryKey }, (existing) => {
    if (!existing?.rows) return existing;
    return {
      ...existing,
      rows: existing.rows.map((entry) =>
        entry.taskId === taskId ? { ...entry, ...updatedRow } : entry,
      ),
    };
  });
}

function invalidateDailyQueries(qc: ReturnType<typeof useQueryClient>, taskId: number) {
  void qc.invalidateQueries({ queryKey: dailyQueryKey });
  void qc.invalidateQueries({ queryKey: ["daily-programme", "cost-budget"] });
  void qc.invalidateQueries({ queryKey: ["tasks", taskId] });
}

function operativeInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DailyNameCell({ row, date, disabled = false }: DailyNameCellProps) {
  const operatives = row.nameOperatives ?? [];
  const cellDisabled = disabled || row.isLocked;

  if (operatives.length === 0) {
    return <span className="italic text-muted-foreground">No allocation</span>;
  }

  return (
    <div className="max-w-[9rem] overflow-x-auto">
      <ul className="flex w-max items-center gap-1.5 py-0.5">
        {operatives.map((op) => (
          <li key={op.operativeId} className="shrink-0">
            <OperativeAvatarPopover
              operative={op}
              taskId={row.taskId}
              date={date}
              disabled={cellDisabled}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function OperativeAvatarPopover({
  operative,
  taskId,
  date,
  disabled,
}: {
  operative: ApiDailyNameOperative;
  taskId: string;
  date: string;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const initials = operativeInitials(operative.operativeName);
  const incomplete = (operative.items ?? []).filter((i) => !i.isTicked);
  const complete = (operative.items ?? []).filter((i) => i.isTicked);

  const completeMutation = useMutation({
    mutationFn: (itemId: number) => dailyProgrammeService.completeItem(itemId, date),
    onSuccess: (res) => {
      if (res.data) mergeRowInCache(qc, taskId, res.data);
      invalidateDailyQueries(qc, taskId);
      toast.success("Item completed");
    },
    onError: (err) => notifyApiError(err, "Unable to complete item"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <AppTooltip content={operative.operativeName} asChild>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
              open && "ring-2 ring-ring",
            )}
            aria-label={`${operative.operativeName} — view items`}
          >
            {initials || "?"}
          </button>
        </PopoverTrigger>
      </AppTooltip>
      <PopoverContent
        className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-72 flex-col overflow-hidden p-0"
        side="bottom"
        align="start"
        collisionPadding={12}
        sideOffset={6}
      >
        <div className="shrink-0 border-b border-border px-3 py-2">
          <p className="truncate text-sm font-semibold">{operative.operativeName}</p>
          <p className="text-[11px] text-muted-foreground">
            {incomplete.length} open · {complete.length} completed
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {operative.items.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">No items</p>
          ) : (
            <>
              {incomplete.length > 0 ? (
                <ItemSection
                  title="To complete"
                  items={incomplete}
                  disabled={disabled || completeMutation.isPending}
                  completingItemId={
                    completeMutation.isPending ? completeMutation.variables : undefined
                  }
                  onComplete={(itemId) => completeMutation.mutate(itemId)}
                />
              ) : null}
              {complete.length > 0 ? (
                <ItemSection title="Completed" items={complete} completed />
              ) : null}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ItemSection({
  title,
  items,
  completed = false,
  disabled = false,
  completingItemId,
  onComplete,
}: {
  title: string;
  items: ApiDailyAssignedItemLine[];
  completed?: boolean;
  disabled?: boolean;
  completingItemId?: string;
  onComplete?: (itemId: number) => void;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1 px-2">
        {items.map((item) => {
          const meta = [
            `Qty ${item.quantity}`,
            item.timeSlotName ?? "—",
            fmtGBP(item.rate),
            !item.isToday ? "carry-over" : null,
          ]
            .filter(Boolean)
            .join(" · ");
          const completing = completingItemId === item.itemId;

          return (
            <li
              key={item.itemId}
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5",
                completed ? "bg-muted/10 opacity-80" : "bg-muted/20",
              )}
            >
              {completed ? (
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm bg-accent/20 text-accent">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
              ) : (
                <AppTooltip content="Mark completed" asChild>
                  <span className="mt-0.5 inline-flex shrink-0">
                    {completing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Checkbox
                        checked={false}
                        disabled={disabled}
                        onCheckedChange={(checked) => {
                          if (checked === true) onComplete?.(item.itemId);
                        }}
                        aria-label={`Complete ${item.productName}`}
                      />
                    )}
                  </span>
                </AppTooltip>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    completed && "text-muted-foreground line-through",
                  )}
                >
                  {item.productName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
