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
import { resolveDailyItemAddBlockReason } from "@/lib/daily";
import { truncateWithEllipsis } from "@/lib/module-ui";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionContext";
import { CAPABILITY_CODES } from "@/lib/access";

type DailyItemsCellProps = {
  row: ApiDailyRow;
  date: string;
  disabled?: boolean;
};

export function DailyItemsCell({ row, date, disabled = false }: DailyItemsCellProps) {
  const qc = useQueryClient();
  const { hasCapability } = usePermissions();
  const canSelectRateItems = hasCapability(CAPABILITY_CODES.selectRateItems);
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
  // Panel always opens; lock / permission block select inside the panel.
  // Past date: unlocked jobs can still assign (for today); only locked rows block.
  const addBlockReason = resolveDailyItemAddBlockReason({
    canModify: !disabled,
    canSelectRateItems,
    isLocked: liveRow.isLocked,
  });

  const trigger = (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent/10 hover:text-foreground",
        open && "bg-accent/10 text-foreground",
      )}
      aria-label={
        addBlockReason
          ? `View items for ${liveRow.propertyName}. ${addBlockReason}`
          : `Assign items for ${liveRow.propertyName}`
      }
    >
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  );

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
        {/* Always openable — assign/select is blocked inside the panel. */}
        {addBlockReason ? (
          <AppTooltip content={addBlockReason} asChild>
            <span className="inline-flex shrink-0">
              <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            </span>
          </AppTooltip>
        ) : (
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        )}
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
            qc.setQueriesData<ApiDailyProgramme>({ queryKey: dailyQueryKey }, (existing: ApiDailyProgramme | undefined) => {
              if (!existing?.rows) return existing;
              return {
                ...existing,
                rows: existing.rows.map((entry: ApiDailyRow) =>
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
