import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppTooltip } from "@/components/AppTooltip";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/form";
import {
  dailyProgrammeService,
  formatResolvedRate,
  type ApiDailyRow,
} from "@/lib/api/services/daily-programme";
import type { ApiTask, ApiTaskItem } from "@/lib/api/services/tasks";
import { tasksService } from "@/lib/api/services/tasks";
import { dailyQueryKey } from "@/routes/daily";
import { tasksQueryKey } from "@/routes/tasks.index";
import { usePermissions } from "@/contexts/PermissionContext";
import { CAPABILITY_CODES } from "@/lib/access";
import {
  fetchOperativeOptions,
  fetchPackageOptions,
  fetchProductOptions,
  fetchTimeSlotOptions,
} from "@/lib/task-dropdowns";
import { notifyApiError } from "@/lib/api/axios";
import { fmtGBP } from "@/lib/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { usersService } from "@/lib/api/services/users";
import {
  findCertificationWarningsForWorkDates,
  type CertificationAssignWarning,
} from "@/lib/operative-certifications";
import { toYmd } from "@/lib/week-ending";

type DayLine = {
  itemId: string;
  productName: string;
  quantity: number;
  doneQty: number;
  remaining: number;
  timeSlotId: string | null;
  timeSlotName: string | null;
  rate: number;
  amount: number;
  isTicked: boolean;
  operativeId: string;
  operativeName: string;
  kind: "package" | "addon";
  tradeGroupId: string | null;
  tradeGroupName: string | null;
  productId: string | null;
  notes: string | null;
};

function linesFromTaskItems(task: ApiTask, date: string): DayLine[] {
  return (task.items ?? [])
    .filter((item) => item.workDate?.slice(0, 10) === date)
    .map((item) => taskItemToLine(item));
}

function taskItemToLine(item: ApiTaskItem): DayLine {
  const qty = Number(item.quantity) || 0;
  const done = Number(item.doneQty ?? 0);
  const hasPackage = Boolean(item.tradeGroupId);
  return {
    itemId: String(item.id),
    productName: item.productName || item.tradeGroupName || "Item",
    quantity: qty,
    doneQty: done,
    remaining: item.remainingQty ?? Math.max(0, qty - done),
    timeSlotId: item.timeSlotId != null ? String(item.timeSlotId) : null,
    timeSlotName: item.timeSlotName,
    rate: Number(item.rate) || 0,
    amount: Number(item.amount) || 0,
    isTicked: Boolean(item.isTicked),
    operativeId: String(item.operativeId),
    operativeName: item.operativeName || "Operative",
    kind: hasPackage ? "package" : "addon",
    tradeGroupId: item.tradeGroupId != null ? String(item.tradeGroupId) : null,
    tradeGroupName: item.tradeGroupName,
    productId: item.productId != null ? String(item.productId) : null,
    notes: item.notes?.trim() || null,
  };
}

function groupByOperative(lines: DayLine[]) {
  const map = new Map<string, { operativeId: string; operativeName: string; items: DayLine[] }>();
  for (const line of lines) {
    const key = line.operativeId || line.operativeName;
    const existing = map.get(key);
    if (existing) existing.items.push(line);
    else {
      map.set(key, {
        operativeId: line.operativeId,
        operativeName: line.operativeName,
        items: [line],
      });
    }
  }
  return Array.from(map.values());
}

type FormMode =
  | { kind: "add" }
  | { kind: "edit"; line: DayLine }
  | null;

type JobDayItemsEditorProps = {
  task: ApiTask;
  row: ApiDailyRow;
  date: string;
  disabled?: boolean;
  /** Open the add form immediately (e.g. empty calendar day). */
  initialShowAdd?: boolean;
  onRowUpdated: (row: ApiDailyRow) => void;
};

export function JobDayItemsEditor({
  task,
  row,
  date,
  disabled = false,
  initialShowAdd = false,
  onRowUpdated,
}: JobDayItemsEditorProps) {
  const qc = useQueryClient();
  const todayYmd = toYmd(new Date());
  const isPast = Boolean(date && date < todayYmd);
  const locked = disabled || row.isLocked || isPast;
  const [formMode, setFormMode] = useState<FormMode>(
    initialShowAdd && !locked ? { kind: "add" } : null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const lines = useMemo(() => linesFromTaskItems(task, date), [task, date]);
  const groups = useMemo(() => groupByOperative(lines), [lines]);
  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

  function invalidateAll(updated?: ApiDailyRow | null) {
    if (updated) onRowUpdated(updated);
    void qc.invalidateQueries({ queryKey: dailyQueryKey });
    void qc.invalidateQueries({ queryKey: tasksQueryKey });
    void qc.invalidateQueries({ queryKey: ["tasks", String(task.id)] });
    void qc.invalidateQueries({ queryKey: ["daily-programme", "job-calendar-day"] });
  }

  const removeMutation = useMutation({
    mutationFn: (itemId: string) =>
      dailyProgrammeService.removeItem(itemId, date),
    onSuccess: (res) => {
      invalidateAll(res.data);
      setConfirmDeleteId(null);
      toast.success("Item removed");
    },
    onError: (err) => notifyApiError(err, "Unable to remove item"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {lines.length} item{lines.length === 1 ? "" : "s"} · {groups.length} operative
            {groups.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">{fmtGBP(total)} total</p>
        </div>
        {locked ? null : (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setFormMode({ kind: "add" })}
            disabled={formMode?.kind === "add"}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        )}
      </div>

      {formMode ? (
        <ItemFormCard
          mode={formMode}
          date={date}
          taskId={row.taskId}
          disabled={locked}
          onCancel={() => setFormMode(null)}
          onSaved={(updated) => {
            invalidateAll(updated);
            setFormMode(null);
          }}
        />
      ) : null}

      {lines.length === 0 && !formMode ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium">No items on this day</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isPast
              ? "Past date — tasks cannot be added to previous dates."
              : "Use Add to assign a package or add-on to an operative."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((group) => {
            const groupTotal = group.items.reduce(
              (sum, line) => sum + (Number(line.amount) || 0),
              0,
            );
            return (
              <div
                key={group.operativeId}
                className="overflow-hidden rounded-lg border border-border/70"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-secondary/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{group.operativeName}</p>
                    <p className="text-[11px] text-muted-foreground">Operative</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmtGBP(groupTotal)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {group.items.length} item{group.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-1.5">Package</th>
                        <th className="px-3 py-1.5">Time</th>
                        <th className="px-3 py-1.5 text-center">Qty</th>
                        <th className="px-3 py-1.5 text-right">Rate</th>
                        <th className="px-3 py-1.5 text-right">Amount</th>
                        <th className="px-3 py-1.5">Status</th>
                        <th className="px-3 py-1.5">Notes</th>
                        <th className="px-3 py-1.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((line) => {
                        const deleting = confirmDeleteId === line.itemId;
                        const busy =
                          removeMutation.isPending &&
                          String(removeMutation.variables) === line.itemId;
                        return (
                          <tr
                            key={line.itemId}
                            className="border-b border-border/40 last:border-b-0"
                          >
                            <td className="px-3 py-2">
                              <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold">
                                {line.productName}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                              {line.timeSlotName || "—"}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium">
                              <AppTooltip content="Qty" asChild>
                                <span className="cursor-default">{line.quantity}</span>
                              </AppTooltip>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmtGBP(line.rate)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {fmtGBP(line.amount)}
                            </td>
                            <td className="px-3 py-2">
                              {line.isTicked ? (
                                <StatusBadge status="Completed" className="text-[10px]" />
                              ) : (
                                <span className="text-xs text-muted-foreground">Open</span>
                              )}
                            </td>
                            <td className="max-w-[8rem] px-3 py-2">
                              {line.notes ? (
                                <AppTooltip content={line.notes} asChild align="start">
                                  <span className="block cursor-default truncate text-xs text-muted-foreground">
                                    {line.notes}
                                  </span>
                                </AppTooltip>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {deleting ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 px-2 text-xs"
                                      disabled={busy || locked}
                                      onClick={() => removeMutation.mutate(line.itemId)}
                                    >
                                      {busy ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        "Confirm"
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs"
                                      disabled={busy}
                                      onClick={() => setConfirmDeleteId(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : !line.isTicked ? (
                                  <>
                                    <AppTooltip content="Edit" asChild>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        disabled={locked}
                                        onClick={() => setFormMode({ kind: "edit", line })}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </AppTooltip>
                                    <AppTooltip content="Delete" asChild>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        disabled={locked}
                                        onClick={() => setConfirmDeleteId(line.itemId)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AppTooltip>
                                  </>
                                ) : null}
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
          })}
        </div>
      )}
    </div>
  );
}

function ItemFormCard({
  mode,
  date,
  taskId,
  disabled,
  onCancel,
  onSaved,
}: {
  mode: Exclude<FormMode, null>;
  date: string;
  taskId: string;
  disabled: boolean;
  onCancel: () => void;
  onSaved: (row: ApiDailyRow) => void;
}) {
  const isEdit = mode.kind === "edit";
  const editLine = mode.kind === "edit" ? mode.line : null;
  const { hasCapability } = usePermissions();
  const canSeeRates = hasCapability(CAPABILITY_CODES.seeRates);
  const rateTouchedRef = useRef(false);

  const [catalogKind, setCatalogKind] = useState<"package" | "addon">(
    editLine?.kind ?? "package",
  );
  const [catalogId, setCatalogId] = useState(
    editLine?.kind === "package"
      ? editLine.tradeGroupId ?? ""
      : editLine?.productId ?? "",
  );
  const [catalogLabel, setCatalogLabel] = useState(
    editLine?.tradeGroupName || editLine?.productName || "",
  );
  const [operativeId, setOperativeId] = useState(editLine?.operativeId ?? "");
  const [operativeLabel, setOperativeLabel] = useState(editLine?.operativeName ?? "");
  const [qty, setQty] = useState(String(editLine?.quantity ?? 1));
  const [rate, setRate] = useState(String(editLine?.rate ?? ""));
  const [timeSlotId, setTimeSlotId] = useState(editLine?.timeSlotId ?? "");
  const [timeSlotLabel, setTimeSlotLabel] = useState(editLine?.timeSlotName ?? "");
  const [certWarnings, setCertWarnings] = useState<CertificationAssignWarning[] | null>(null);
  const [certCheckPending, setCertCheckPending] = useState(false);

  const timeSlotsQuery = useQuery({
    queryKey: ["tasks", "time-slots"],
    queryFn: async () => (await tasksService.timeSlots()).data ?? [],
    staleTime: 60_000,
  });

  const resolvedRateQuery = useQuery({
    queryKey: [
      "daily-programme",
      "resolve-rate",
      taskId,
      date,
      catalogKind,
      catalogId,
      operativeId || null,
    ],
    enabled: canSeeRates && !isEdit && Boolean(catalogId),
    queryFn: async () => {
      const res = await dailyProgrammeService.resolveRate(taskId, {
        date,
        productId: catalogKind === "addon" ? catalogId : undefined,
        tradeGroupId: catalogKind === "package" ? catalogId : undefined,
        operativeId: operativeId || undefined,
      });
      return res.data;
    },
    staleTime: 15_000,
    retry: 1,
  });

  useEffect(() => {
    if (isEdit) return;
    rateTouchedRef.current = false;
    setRate("");
  }, [catalogKind, catalogId, isEdit]);

  useEffect(() => {
    if (isEdit || rateTouchedRef.current || resolvedRateQuery.data == null) return;
    setRate(formatResolvedRate(resolvedRateQuery.data.rate));
  }, [resolvedRateQuery.data, isEdit]);

  useEffect(() => {
    if (timeSlotId || !timeSlotsQuery.data?.length) return;
    const first =
      timeSlotsQuery.data.find((t) => t.isActive !== false) ?? timeSlotsQuery.data[0];
    if (first) {
      setTimeSlotId(String(first.id));
      setTimeSlotLabel(first.name);
    }
  }, [timeSlotId, timeSlotsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payloadBase = {
        date,
        operativeId,
        rate: isEdit || rateTouchedRef.current ? Number(rate) || 0 : 0,
        quantity: Number(qty) || 1,
        timeSlotId: timeSlotId || null,
      };

      if (isEdit && editLine) {
        return dailyProgrammeService.updateItem(editLine.itemId, {
          date,
          operativeId,
          rate: Number(rate) || 0,
          quantity: Number(qty) || 1,
          timeSlotId: timeSlotId || null,
        });
      }

      if (catalogKind === "package") {
        return dailyProgrammeService.assignPackage(taskId, {
          ...payloadBase,
          tradeGroupId: catalogId,
        });
      }
      return dailyProgrammeService.assignAddOn(taskId, {
        ...payloadBase,
        productId: catalogId,
      });
    },
    onSuccess: (res) => {
      toast.success(isEdit ? "Item updated" : "Item added");
      if (res.data) onSaved(res.data);
    },
    onError: (err) =>
      notifyApiError(err, isEdit ? "Unable to update item" : "Unable to add item"),
  });

  function handleSave() {
    if (date < toYmd(new Date())) {
      toast.warning("Cannot add or edit tasks for past dates.");
      return;
    }
    if (!operativeId) {
      toast.warning("Select an operative.");
      return;
    }
    if (!isEdit && !catalogId) {
      toast.warning(catalogKind === "package" ? "Select a package." : "Select an add-on.");
      return;
    }
    if (!timeSlotId) {
      toast.warning("Select a time slot.");
      return;
    }
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.warning("Enter a valid quantity.");
      return;
    }

    const operativeChanged = !isEdit || operativeId !== (editLine?.operativeId ?? "");
    if (!operativeChanged) {
      saveMutation.mutate();
      return;
    }

    setCertCheckPending(true);
    void (async () => {
      try {
        const certifications =
          (await usersService.getAssignCertifications(operativeId)).data ?? [];
        const warnings = findCertificationWarningsForWorkDates(certifications, [date]);
        if (warnings.length > 0) {
          setCertWarnings(warnings);
          return;
        }
        saveMutation.mutate();
      } catch (err) {
        notifyApiError(err, "Unable to check operative certificates");
      } finally {
        setCertCheckPending(false);
      }
    })();
  }

  return (
    <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
      {certWarnings ? (
        <Modal
          open
          onClose={() => setCertWarnings(null)}
          title="Certificate expiry warning"
          subtitle={`${operativeLabel || "This operative"} has certificate(s) expired or expiring within 7 days of the work date.`}
          size="sm"
          showCloseButton={false}
        >
          <div className="space-y-3">
            <ul className="space-y-1.5 text-sm">
              {certWarnings.map((w) => (
                <li
                  key={`${w.name}-${w.expiryDate}`}
                  className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="min-w-0 font-medium text-foreground">{w.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    Expires {w.displayExpiry}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setCertWarnings(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setCertWarnings(null);
                  saveMutation.mutate();
                }}
              >
                Confirm assign
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{isEdit ? "Edit item" : "Add item"}</p>
          {!isEdit ? (
            <div className="inline-flex rounded-md border border-border bg-card p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  catalogKind === "package"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setCatalogKind("package");
                  setCatalogId("");
                  setCatalogLabel("");
                  setRate("");
                  rateTouchedRef.current = false;
                }}
              >
                Package
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  catalogKind === "addon"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setCatalogKind("addon");
                  setCatalogId("");
                  setCatalogLabel("");
                  setRate("");
                  rateTouchedRef.current = false;
                }}
              >
                Add-on
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onCancel}
          aria-label="Close form"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* One row: package 3 · operator 3 · qty 2 · time 2 · rate 2 */}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-3 min-w-0">
          <label className="mb-1 block text-[11px] text-muted-foreground">
            {isEdit ? "Package / product" : catalogKind === "package" ? "Package" : "Add-on"}
          </label>
          {isEdit ? (
            <p className="flex h-9 items-center truncate rounded-md border border-border bg-card px-3 text-sm font-medium">
              {editLine?.productName}
            </p>
          ) : catalogKind === "package" ? (
            <SearchableSelect
              value={catalogId}
              onValueChange={setCatalogId}
              onSelect={(opt) => {
                setCatalogId(opt.value);
                setCatalogLabel(opt.label);
              }}
              placeholder="Select package"
              searchPlaceholder="Search packages…"
              queryKey={["lookups", "packages", "job-day"]}
              fetchOptions={fetchPackageOptions}
              selectedLabel={catalogLabel || null}
              disabled={disabled || saveMutation.isPending}
              triggerClassName="h-9 text-sm"
            />
          ) : (
            <SearchableSelect
              value={catalogId}
              onValueChange={setCatalogId}
              onSelect={(opt) => {
                setCatalogId(opt.value);
                setCatalogLabel(opt.label);
              }}
              placeholder="Select add-on"
              searchPlaceholder="Search add-ons…"
              queryKey={["lookups", "products", "job-day"]}
              fetchOptions={fetchProductOptions}
              selectedLabel={catalogLabel || null}
              disabled={disabled || saveMutation.isPending}
              triggerClassName="h-9 text-sm"
            />
          )}
        </div>

        <div className="col-span-3 min-w-0">
          <label className="mb-1 block text-[11px] text-muted-foreground">Operative</label>
          <SearchableSelect
            value={operativeId}
            onValueChange={setOperativeId}
            onSelect={(opt) => setOperativeLabel(opt.label)}
            placeholder="Select operative"
            searchPlaceholder="Search operatives…"
            queryKey={["lookups", "operatives", "job-day", taskId]}
            fetchOptions={fetchOperativeOptions}
            selectedLabel={operativeLabel || null}
            disabled={disabled || saveMutation.isPending}
            triggerClassName="h-9 text-sm"
          />
        </div>

        <div className="col-span-2 min-w-0">
          <label className="mb-1 block text-[11px] text-muted-foreground">Qty</label>
          <Input
            type="number"
            min={0.01}
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-9"
            disabled={disabled || saveMutation.isPending}
          />
        </div>

        <div className="col-span-2 min-w-0">
          <label className="mb-1 block text-[11px] text-muted-foreground">Time</label>
          <SearchableSelect
            value={timeSlotId}
            onValueChange={setTimeSlotId}
            onSelect={(opt) => setTimeSlotLabel(opt.label)}
            placeholder="Time"
            searchPlaceholder="Search…"
            queryKey={["lookups", "time-slots", "job-day"]}
            fetchOptions={fetchTimeSlotOptions}
            selectedLabel={timeSlotLabel || null}
            disabled={disabled || saveMutation.isPending}
            triggerClassName="h-9 text-sm"
          />
        </div>

        {canSeeRates ? (
        <div className="col-span-2 min-w-0">
          <label className="mb-1 block text-[11px] text-muted-foreground">Rate (£)</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => {
              rateTouchedRef.current = true;
              setRate(e.target.value);
            }}
            placeholder={!isEdit && resolvedRateQuery.isFetching ? "…" : "Auto"}
            className="h-9"
            disabled={disabled || saveMutation.isPending}
          />
        </div>
        ) : null}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onCancel}
          disabled={saveMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8"
          onClick={handleSave}
          disabled={disabled || saveMutation.isPending || certCheckPending}
          >
          {saveMutation.isPending || certCheckPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isEdit ? (
            "Save"
          ) : (
            "Add item"
          )}
        </Button>
      </div>
    </div>
  );
}
