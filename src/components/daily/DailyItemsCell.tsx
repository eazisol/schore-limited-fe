import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppTooltip } from "@/components/AppTooltip";
import { DailyAssignmentPanel } from "@/components/daily/DailyAssignmentPanel";
import type { ApiDailyProgramme, ApiDailyRow } from "@/lib/api/services/daily-programme";
import { dailyQueryKey } from "@/routes/daily";
import {
  dailyAssignmentDetail,
  dailyAssignmentSummary,
  filterAssignedGroupsWithoutOpenApprovals,
} from "@/lib/daily-packages";
import { truncateWithEllipsis } from "@/lib/module-ui";
import { cn } from "@/lib/utils";

type DailyItemsCellProps = {
  row: ApiDailyRow;
  date: string;
  disabled?: boolean;
};

export function DailyItemsCell({ row, date, disabled = false }: DailyItemsCellProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [liveRow, setLiveRow] = useState(row);

  useEffect(() => {
    setLiveRow(row);
  }, [row]);

  const assignedByOperative = liveRow.assignedByOperative ?? [];
  const visibleAssigned = filterAssignedGroupsWithoutOpenApprovals(assignedByOperative);
  const summary = dailyAssignmentSummary(assignedByOperative);
  const fullSummary = dailyAssignmentDetail(assignedByOperative);
  const hasAssigned = visibleAssigned.length > 0;
  // Locked rows may still open to tick existing items; panel blocks new assigns.

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex min-w-0 items-center gap-1">
        <AppTooltip content={fullSummary} asChild align="start">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              !hasAssigned && "italic text-muted-foreground",
            )}
          >
            {truncateWithEllipsis(summary, 28)}
          </span>
        </AppTooltip>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
              open && "bg-accent/10 text-foreground",
            )}
            aria-label={`Assign items for ${liveRow.propertyName}`}
            disabled={disabled}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="flex max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(36rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        side="top"
        align="end"
        collisionPadding={16}
        sideOffset={8}
      >
        <DailyAssignmentPanel
          row={liveRow}
          date={date}
          disabled={disabled}
          compact
          className="max-h-[min(32rem,var(--radix-popover-content-available-height))] rounded-none border-0"
          onRowUpdated={(updated) => {
            setLiveRow(updated);
            qc.setQueriesData<ApiDailyProgramme>({ queryKey: dailyQueryKey }, (existing) => {
              if (!existing?.rows) return existing;
              return {
                ...existing,
                rows: existing.rows.map((entry) =>
                  String(entry.taskId) === String(updated.taskId)
                    ? { ...entry, ...updated }
                    : entry,
                ),
              };
            });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
