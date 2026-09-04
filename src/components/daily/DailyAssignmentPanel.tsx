import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/form";
import { AppTooltip } from "@/components/AppTooltip";
import {
  dailyProgrammeService,
  type ApiDailyAssignedItemLine,
  type ApiDailyAssignedOperative,
  type ApiDailyProgramme,
  type ApiDailyRow,
} from "@/lib/api/services/daily-programme";
import { tradeGroupsService } from "@/lib/api/services/trade-groups";
import { productsService } from "@/lib/api/services/products";
import { tasksService } from "@/lib/api/services/tasks";
import { dailyQueryKey } from "@/routes/daily";
import { tasksQueryKey } from "@/routes/tasks.index";
import {
  filterUnassignedAddOns,
  filterUnassignedPackages,
} from "@/lib/daily-packages";
import { fetchOperativeOptions, fetchTimeSlotOptions } from "@/lib/task-dropdowns";
import { notifyApiError } from "@/lib/api/axios";
import { fmtGBP } from "@/lib/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type UnassignedKind = "package" | "addon";

function mergeRowInCache(
  qc: ReturnType<typeof useQueryClient>,
  taskId: string | number,
  updatedRow: ApiDailyRow,
) {
  const id = String(taskId);
  qc.setQueriesData<ApiDailyProgramme>({ queryKey: dailyQueryKey }, (existing) => {
    if (!existing?.rows) return existing;
    return {
      ...existing,
      rows: existing.rows.map((entry) =>
        String(entry.taskId) === id ? { ...entry, ...updatedRow } : entry,
      ),
    };
  });
}

function invalidateAfterChange(qc: ReturnType<typeof useQueryClient>, taskId: string | number) {
  void qc.invalidateQueries({ queryKey: dailyQueryKey });
  void qc.invalidateQueries({ queryKey: ["daily-programme", "cost-budget"] });
  void qc.invalidateQueries({ queryKey: tasksQueryKey });
  void qc.invalidateQueries({ queryKey: ["tasks", String(taskId)] });
}

type DailyAssignmentPanelProps = {
  row: ApiDailyRow;
  date: string;
  disabled?: boolean;
  className?: string;
  /** Compact height for popover; taller for modal. */
  compact?: boolean;
  onRowUpdated?: (row: ApiDailyRow) => void;
};

/** Shared Daily Programmer assign / complete / remove panel (popover or modal). */
export function DailyAssignmentPanel({
  row,
  date,
  disabled = false,
  className,
  compact = false,
  onRowUpdated,
}: DailyAssignmentPanelProps) {
  const qc = useQueryClient();
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState<UnassignedKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignOperativeId, setAssignOperativeId] = useState("");
  const [assignOperativeLabel, setAssignOperativeLabel] = useState("");
  const [assignRate, setAssignRate] = useState("");
  const [assignQty, setAssignQty] = useState("1");
  const [assignTimeSlotId, setAssignTimeSlotId] = useState("");
  const [assignTimeSlotLabel, setAssignTimeSlotLabel] = useState("");

  const assignedByOperative = row.assignedByOperative ?? [];
  const unassignedPackages = row.unassignedPackages ?? [];
  const unassignedAddOns = row.unassignedAddOns ?? [];
  const cellDisabled = disabled || row.isLocked;

  const timeSlotsQuery = useQuery({
    queryKey: ["tasks", "time-slots"],
    queryFn: async () => (await tasksService.timeSlots()).data ?? [],
    staleTime: 60_000,
  });

  const filteredPackages = useMemo(
    () => filterUnassignedPackages(unassignedPackages, unassignedSearch),
    [unassignedPackages, unassignedSearch],
  );
  const filteredAddOns = useMemo(
    () => filterUnassignedAddOns(unassignedAddOns, unassignedSearch),
    [unassignedAddOns, unassignedSearch],
  );

  useEffect(() => {
    setSelectedKind(null);
    setSelectedId(null);
    setUnassignedSearch("");
    setAssignOperativeId("");
    setAssignOperativeLabel("");
    setAssignRate("");
    setAssignQty("1");
    setAssignTimeSlotId("");
    setAssignTimeSlotLabel("");
  }, [date, row.taskId]);

  useEffect(() => {
    if (assignTimeSlotId || !timeSlotsQuery.data?.length) return;
    const first = timeSlotsQuery.data.find((t) => t.isActive !== false) ?? timeSlotsQuery.data[0];
    if (first) {
      setAssignTimeSlotId(String(first.id));
      setAssignTimeSlotLabel(first.name);
    }
  }, [assignTimeSlotId, timeSlotsQuery.data]);

  useEffect(() => {
    if (!selectedKind || selectedId == null) return;
    let cancelled = false;
    void (async () => {
      try {
        if (selectedKind === "package") {
          const group = (await tradeGroupsService.get(selectedId)).data;
          if (cancelled || !group?.items?.length) return;
          const firstPrice = group.items.find((item) => item.salePrice != null)?.salePrice;
          if (firstPrice != null) setAssignRate(String(firstPrice));
        } else {
          const product = (await productsService.get(selectedId)).data;
          if (cancelled || product?.salePrice == null) return;
          setAssignRate(String(product.salePrice));
        }
      } catch {
        /* optional default rate */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKind, selectedId]);

  const applyUpdatedRow = (updatedRow: ApiDailyRow | null | undefined, message: string) => {
    if (updatedRow) {
      mergeRowInCache(qc, row.taskId, updatedRow);
      onRowUpdated?.(updatedRow);
    }
    invalidateAfterChange(qc, row.taskId);
    setSelectedKind(null);
    setSelectedId(null);
    setAssignOperativeId("");
    setAssignOperativeLabel("");
    setAssignRate("");
    setAssignQty("1");
    toast.success(message);
  };

  const assignPayloadBase = () => ({
    date,
    operativeId: assignOperativeId,
    rate: Number(assignRate) || 0,
    quantity: Number(assignQty) || 1,
    timeSlotId: assignTimeSlotId || null,
  });

  const assignPackageMutation = useMutation({
    mutationFn: (tradeGroupId: string) =>
      dailyProgrammeService.assignPackage(row.taskId, {
        ...assignPayloadBase(),
        tradeGroupId,
      }),
    onSuccess: (res) => applyUpdatedRow(res.data, "Package assigned"),
    onError: (err) => notifyApiError(err, "Unable to assign package"),
  });

  const assignAddOnMutation = useMutation({
    mutationFn: (productId: string) =>
      dailyProgrammeService.assignAddOn(row.taskId, {
        ...assignPayloadBase(),
        productId,
      }),
    onSuccess: (res) => applyUpdatedRow(res.data, "Add-on assigned"),
    onError: (err) => notifyApiError(err, "Unable to assign add-on"),
  });

  const completeMutation = useMutation({
    mutationFn: (itemId: string) => dailyProgrammeService.completeItem(itemId, date),
    onSuccess: (res) => {
      if (res.data) {
        mergeRowInCache(qc, row.taskId, res.data);
        onRowUpdated?.(res.data);
      }
      invalidateAfterChange(qc, row.taskId);
      toast.success("Item completed");
    },
    onError: (err) => notifyApiError(err, "Unable to complete item"),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => dailyProgrammeService.removeItem(itemId, date),
    onSuccess: (res) => {
      if (res.data) {
        mergeRowInCache(qc, row.taskId, res.data);
        onRowUpdated?.(res.data);
      }
      invalidateAfterChange(qc, row.taskId);
      toast.success("Item removed");
    },
    onError: (err) => notifyApiError(err, "Unable to remove item"),
  });

  const pending =
    assignPackageMutation.isPending ||
    assignAddOnMutation.isPending ||
    completeMutation.isPending ||
    removeMutation.isPending;

  function clearAssignSelection() {
    setSelectedKind(null);
    setSelectedId(null);
    setAssignOperativeId("");
    setAssignOperativeLabel("");
    setAssignRate("");
    setAssignQty("1");
  }

  function selectUnassigned(kind: UnassignedKind, id: string) {
    setSelectedKind(kind);
    setSelectedId(id);
    setAssignRate("");
    setAssignQty("1");
  }

  function handleAssign() {
    if (cellDisabled || pending) return;
    if (!selectedKind || selectedId == null) {
      toast.warning("Select a package or add-on first.");
      return;
    }
    if (!assignOperativeId) {
      toast.warning("Select an operative.");
      return;
    }
    if (!assignTimeSlotId) {
      toast.warning("Select a time slot.");
      return;
    }
    const qty = Number(assignQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.warning("Enter a valid quantity.");
      return;
    }
    if (selectedKind === "package") {
      assignPackageMutation.mutate(selectedId);
    } else {
      assignAddOnMutation.mutate(selectedId);
    }
  }

  const selectedLabel =
    selectedKind === "package"
      ? unassignedPackages.find((p) => p.tradeGroupId === selectedId)?.tradeGroupName
      : selectedKind === "addon"
        ? unassignedAddOns.find((a) => a.productId === selectedId)?.productName
        : null;

  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-lg border border-border bg-card",
        compact
          ? "max-h-[min(32rem,70vh)] sm:grid-cols-2"
          : "min-h-[22rem] sm:min-h-[26rem] sm:grid-cols-2",
        className,
      )}
    >
      <div className="flex min-h-0 flex-col border-b border-border sm:border-b-0 sm:border-r">
        <div className="shrink-0 border-b border-border px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Unassigned
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Tap a package or add-on, then assign operative
          </p>
          <Input
            value={unassignedSearch}
            onChange={(e) => setUnassignedSearch(e.target.value)}
            placeholder="Search packages & add-ons…"
            className="mt-1.5 h-8 text-xs"
            disabled={cellDisabled}
            aria-label="Search unassigned items"
          />
        </div>
        {selectedLabel ? (
          <div className="shrink-0 space-y-2 border-b border-border bg-muted/30 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium">
                {selectedKind === "addon" ? "Add-on: " : "Package: "}
                {selectedLabel}
              </p>
              <button
                type="button"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                onClick={clearAssignSelection}
                disabled={cellDisabled || pending}
                aria-label="Close assignment form"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Operative</label>
              <SearchableSelect
                value={assignOperativeId}
                onValueChange={setAssignOperativeId}
                onSelect={(opt) => setAssignOperativeLabel(opt.label)}
                placeholder="Select operative"
                searchPlaceholder="Search operatives…"
                queryKey={["lookups", "operatives", "daily-assign", row.taskId]}
                fetchOptions={fetchOperativeOptions}
                selectedLabel={assignOperativeLabel || null}
                disabled={cellDisabled || pending}
                triggerClassName="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Qty</label>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={assignQty}
                  onChange={(e) => setAssignQty(e.target.value)}
                  className="h-8 text-xs"
                  disabled={cellDisabled || pending}
                  aria-label="Quantity"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Time</label>
                <SearchableSelect
                  value={assignTimeSlotId}
                  onValueChange={setAssignTimeSlotId}
                  onSelect={(opt) => setAssignTimeSlotLabel(opt.label)}
                  placeholder="Time"
                  searchPlaceholder="Search…"
                  queryKey={["lookups", "time-slots", "daily-assign"]}
                  fetchOptions={fetchTimeSlotOptions}
                  selectedLabel={assignTimeSlotLabel || null}
                  disabled={cellDisabled || pending}
                  triggerClassName="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Rate (£)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={assignRate}
                onChange={(e) => setAssignRate(e.target.value)}
                className="h-8 text-xs"
                disabled={cellDisabled || pending}
                aria-label="Rate"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={cellDisabled || pending}
              onClick={handleAssign}
            >
              {assignPackageMutation.isPending || assignAddOnMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Assign to roll"
              )}
            </Button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {filteredPackages.length > 0 ? (
            <div>
              <p className="px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                Packages
              </p>
              <ul>
                {filteredPackages.map((pkg) => (
                  <li key={`pkg-${pkg.tradeGroupId}`}>
                    <button
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-accent/10",
                        selectedKind === "package" &&
                          selectedId === pkg.tradeGroupId &&
                          "bg-accent/10",
                      )}
                      disabled={cellDisabled || pending}
                      onClick={() => selectUnassigned("package", pkg.tradeGroupId)}
                    >
                      <span className="block truncate font-medium">{pkg.tradeGroupName}</span>
                      {pkg.tradeName ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {pkg.tradeName}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {filteredAddOns.length > 0 ? (
            <div>
              <p className="px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                Add-ons
              </p>
              <ul>
                {filteredAddOns.map((addOn) => (
                  <li key={`addon-${addOn.productId}`}>
                    <button
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-accent/10",
                        selectedKind === "addon" &&
                          selectedId === addOn.productId &&
                          "bg-accent/10",
                      )}
                      disabled={cellDisabled || pending}
                      onClick={() => selectUnassigned("addon", addOn.productId)}
                    >
                      <span className="block truncate font-medium">{addOn.productName}</span>
                      <span className="block truncate text-xs text-muted-foreground">Add-on</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {filteredPackages.length === 0 && filteredAddOns.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {unassignedPackages.length === 0 && unassignedAddOns.length === 0
                ? "Nothing available to assign"
                : "No matches"}
            </p>
          ) : null}
        </div>
      </div>

      <AssignedTree
        groups={assignedByOperative}
        disabled={cellDisabled || pending}
        completingItemId={
          completeMutation.isPending ? completeMutation.variables : undefined
        }
        removingItemId={removeMutation.isPending ? removeMutation.variables : undefined}
        onComplete={(itemId) => completeMutation.mutate(itemId)}
        onRemove={(itemId) => removeMutation.mutate(itemId)}
      />
    </div>
  );
}

function AssignedTree({
  groups,
  disabled,
  completingItemId,
  removingItemId,
  onComplete,
  onRemove,
}: {
  groups: ApiDailyAssignedOperative[];
  disabled: boolean;
  completingItemId: string | undefined;
  removingItemId: string | undefined;
  onComplete: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assigned
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Tick to complete · X to remove
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {groups.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            No assigned items — pick a package on the left
          </p>
        ) : (
          groups.map((operative) => (
            <div
              key={operative.operativeId}
              className="border-b border-border/60 px-3 py-2 last:border-b-0"
            >
              <p className="text-sm font-semibold">{operative.operativeName}</p>
              {operative.packages.map((pkg) => (
                <div key={pkg.tradeGroupId} className="mt-2 pl-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Package: {pkg.tradeGroupName}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {pkg.items.map((item) => (
                      <AssignedItemLine
                        key={item.itemId}
                        item={item}
                        disabled={disabled}
                        completing={completingItemId === item.itemId}
                        removing={removingItemId === item.itemId}
                        onComplete={() => onComplete(item.itemId)}
                        onRemove={() => onRemove(item.itemId)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
              {operative.addOns.length > 0 ? (
                <div className="mt-2 pl-2">
                  <p className="text-xs font-medium text-muted-foreground">Add-ons</p>
                  <ul className="mt-1 space-y-1">
                    {operative.addOns.map((item) => (
                      <AssignedItemLine
                        key={item.itemId}
                        item={item}
                        disabled={disabled}
                        completing={completingItemId === item.itemId}
                        removing={removingItemId === item.itemId}
                        onComplete={() => onComplete(item.itemId)}
                        onRemove={() => onRemove(item.itemId)}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AssignedItemLine({
  item,
  disabled,
  completing,
  removing,
  onComplete,
  onRemove,
}: {
  item: ApiDailyAssignedItemLine;
  disabled: boolean;
  completing: boolean;
  removing: boolean;
  onComplete: () => void;
  onRemove: () => void;
}) {
  const lineBusy = completing || removing;
  const meta = [
    `Qty ${item.quantity}`,
    item.timeSlotName ?? "—",
    fmtGBP(item.rate),
    !item.isToday ? "carry-over" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-start gap-2 rounded-md bg-muted/20 px-2 py-1.5">
      <AppTooltip content="Mark completed" asChild>
        <span className="mt-0.5 inline-flex shrink-0">
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Checkbox
              checked={Boolean(item.isTicked)}
              disabled={disabled || removing || item.isTicked}
              onCheckedChange={(checked) => {
                if (checked === true) onComplete();
              }}
              aria-label={`Complete ${item.productName}`}
            />
          )}
        </span>
      </AppTooltip>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.productName}</p>
        <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
        {item.isTicked ? (
          <p className="text-[10px] font-medium text-success">Completed</p>
        ) : null}
      </div>
      <AppTooltip content="Remove from assignment" asChild>
        <button
          type="button"
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={disabled || lineBusy}
          onClick={onRemove}
          aria-label={`Remove ${item.productName}`}
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </button>
      </AppTooltip>
    </li>
  );
}
