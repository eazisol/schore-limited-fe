import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AppTooltip } from "@/components/AppTooltip";
import {
  dailyProgrammeService,
  type ApiDailyItemOption,
  type ApiDailyProgramme,
  type ApiDailyRow,
} from "@/lib/api/services/daily-programme";
import { tasksService } from "@/lib/api/services/tasks";
import { dailyQueryKey } from "@/routes/daily";
import {
  buildDailyItemOptions,
  dailyItemSelectionDetail,
  dailyItemSelectionSummary,
} from "@/lib/daily-items";
import { notifyApiError } from "@/lib/api/axios";
import { truncateWithEllipsis } from "@/lib/module-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DailyItemsCellProps = {
  row: ApiDailyRow;
  date: string;
  disabled?: boolean;
};

export function DailyItemsCell({ row, date, disabled = false }: DailyItemsCellProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const apiOptions = row.itemOptions ?? [];
  const needsTaskFetch = apiOptions.length === 0;

  const taskQuery = useQuery({
    queryKey: ["tasks", row.taskId, "daily-item-options"],
    queryFn: async () => (await tasksService.get(row.taskId)).data,
    enabled: needsTaskFetch,
    staleTime: 60_000,
  });

  const options = useMemo(() => {
    if (apiOptions.length > 0) return apiOptions;
    if (!taskQuery.data?.items?.length) return [];
    return buildDailyItemOptions(taskQuery.data.items, date);
  }, [apiOptions, taskQuery.data, date]);

  const summary = useMemo(() => dailyItemSelectionSummary(options), [options]);
  const fullSummary = useMemo(() => dailyItemSelectionDetail(options), [options]);
  const hasSelected = options.some((option) => option.isSelected);

  const mutation = useMutation({
    mutationFn: (selectedSourceItemIds: number[]) =>
      dailyProgrammeService.setItems(row.taskId, date, selectedSourceItemIds),
    onSuccess: (res) => {
      const updatedRow = res.data;
      if (updatedRow) {
        qc.setQueriesData<ApiDailyProgramme>({ queryKey: dailyQueryKey }, (existing) => {
          if (!existing?.rows) return existing;
          return {
            ...existing,
            rows: existing.rows.map((entry) =>
              entry.taskId === row.taskId ? { ...entry, ...updatedRow } : entry,
            ),
          };
        });
      }
      void qc.invalidateQueries({ queryKey: dailyQueryKey });
      void qc.invalidateQueries({ queryKey: ["daily-programme", "cost-budget"] });
      void qc.invalidateQueries({ queryKey: ["tasks", row.taskId] });
    },
    onError: (err) => notifyApiError(err, "Unable to update items"),
  });

  function toggleOption(option: ApiDailyItemOption, checked: boolean) {
    if (disabled || mutation.isPending) return;
    if (option.isTicked && !checked) {
      toast.warning("Ticked items cannot be removed from today's roll.");
      return;
    }

    const current = new Set(
      options.filter((entry) => entry.isSelected).map((entry) => entry.sourceItemId),
    );
    if (checked) {
      current.add(option.sourceItemId);
    } else {
      current.delete(option.sourceItemId);
    }

    mutation.mutate([...current]);
  }

  const cellDisabled = disabled || row.isLocked;
  const loading = needsTaskFetch && taskQuery.isLoading;
  const hasOptions = options.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex min-w-0 items-center gap-1">
        <AppTooltip content={fullSummary} asChild align="start">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              !hasSelected && "italic text-muted-foreground",
            )}
          >
            {loading ? "Loading…" : truncateWithEllipsis(summary, 28)}
          </span>
        </AppTooltip>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
              open && "bg-accent/10 text-foreground",
            )}
            aria-label={`Select items for ${row.propertyName}`}
            disabled={cellDisabled || loading || mutation.isPending}
          >
            {mutation.isPending || loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-72 p-0" align="start">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading items…
          </div>
        ) : hasOptions ? (
          <ul className="max-h-64 overflow-y-auto py-1">
            {options.map((option) => {
              const checkboxId = `daily-item-${row.taskId}-${option.sourceItemId}`;
              return (
                <li key={option.sourceItemId}>
                  <label
                    htmlFor={checkboxId}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-accent/10",
                      option.isTicked && "opacity-80",
                    )}
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={option.isSelected}
                      disabled={
                        cellDisabled ||
                        mutation.isPending ||
                        (option.isTicked && option.isSelected)
                      }
                      onCheckedChange={(checked) => toggleOption(option, checked === true)}
                      className="mt-0.5"
                      aria-label={option.label}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{option.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.operativeName}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No items available for this task.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
