import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useEffect, useMemo, useRef, useState } from "react";
import { TextField, TextareaField, CreatableSearchableSelectField } from "@/components/form";
import { SearchableSelect } from "@/components/form/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import { AppTooltip } from "@/components/AppTooltip";
import { Plus, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtGBP } from "@/lib/data";
import { truncateWithEllipsis } from "@/lib/module-ui";
import {
  emptyTaskItem,
  DESCRIPTION_MAX_LENGTH,
  type TaskFormValues,
  type TaskItemFormValues,
} from "@/lib/task-form";
import {
  fetchJobTypeOptions,
  fetchOperativeOptions,
  fetchPackageOrAddonOptions,
  fetchPropertyOptions,
  fetchSiteManagerOptions,
  fetchTaskStatusOptions,
  fetchTradeOptions,
  packageOrAddonSelectionValue,
  parsePackageOrAddonValue,
} from "@/lib/task-dropdowns";
import type { SearchableSelectOption } from "@/components/form";
import { usersService } from "@/lib/api/services/users";
import { tradeGroupsService } from "@/lib/api/services/trade-groups";
import { productsService } from "@/lib/api/services/products";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HoldDetailsModal, type HoldDetails } from "@/components/tasks/HoldDetailsModal";
import { getTaskStatusCode, isHoldStatusCode } from "@/lib/task-hold";
import { jobTypesService } from "@/lib/api/services/job-types";
import { tasksService } from "@/lib/api/services/tasks";
import {
  findCertificationWarningsForWorkDates,
  formatCertificationWarningSubtitle,
  type CertificationAssignWarning,
} from "@/lib/operative-certifications";
import { notifyApiError } from "@/lib/api/axios";

/** Form grouping key for template lines that have no operative yet. */
const UNASSIGNED_OPERATIVE_KEY = "__unassigned";

/** Clone item rows so replace() keeps identity fields (id, operativeId) intact. */
function snapshotItems(rows: TaskItemFormValues[]): TaskItemFormValues[] {
  return rows.map((row) => ({
    ...emptyTaskItem(),
    ...row,
    id: row.id ?? "",
    operativeId: row.operativeId ?? "",
    workDate: row.workDate ?? "",
    tradeId: row.tradeId ?? "",
    itemKind: row.itemKind === "product" ? "product" : "tradeGroup",
    tradeGroupId: row.tradeGroupId ?? "",
    productId: row.productId ?? "",
    quantity: row.quantity ?? "1",
    doneQty: row.doneQty ?? "0",
    rate: row.rate ?? "0",
    applyRatePermanently: Boolean(row.applyRatePermanently),
    timeSlotId: row.timeSlotId ?? "",
    isTicked: Boolean(row.isTicked),
    notes: row.notes ?? "",
  }));
}

export type TaskFormSelectedLabels = {
  property?: string | null;
  jobType?: string | null;
  status?: string | null;
  siteManager?: string | null;
};

export type TaskItemSelectedLabels = {
  operative?: string | null;
  tradeGroup?: string | null;
  product?: string | null;
};

type ItemAddState = {
  itemKind: "tradeGroup" | "product";
  tradeGroupId: string;
  tradeGroupLabel: string;
  productId: string;
  productLabel: string;
};

const defaultAddState = (): ItemAddState => ({
  itemKind: "tradeGroup",
  tradeGroupId: "",
  tradeGroupLabel: "",
  productId: "",
  productLabel: "",
});

export function TaskFormFields({
  disabled = false,
  embedded = false,
  itemsLocked = false,
  selectedLabels,
  itemSelectedLabels = {},
}: {
  disabled?: boolean;
  embedded?: boolean;
  /** When true, add-item controls are disabled (daily per-task lock). */
  itemsLocked?: boolean;
  selectedLabels?: TaskFormSelectedLabels;
  /** Keyed by existing TaskItem id (string). */
  itemSelectedLabels?: Record<string, TaskItemSelectedLabels>;
}) {
  const { control, setValue, getValues, unregister } = useFormContext<TaskFormValues>();
  const { fields, append, replace } = useFieldArray<TaskFormValues, "items", "fieldKey">({
    control,
    name: "items",
    // Backend TaskItem.id must not be RHF's array key — new rows share id "".
    keyName: "fieldKey",
  });
  const addControlsDisabled = disabled || itemsLocked;
  const jobTypeId = useWatch({ control, name: "jobTypeId" });
  const startDate = useWatch({ control, name: "startDate" });
  const templateSeededRef = useRef<string>("");
  const [activeOperativeId, setActiveOperativeId] = useState<string>("");
  const [activeOperativeLabel, setActiveOperativeLabel] = useState<string>("");
  const [showAddComposer, setShowAddComposer] = useState(false);
  const [operativeLabels, setOperativeLabels] = useState<Record<string, string>>({});
  const [tradeGroupLabels, setTradeGroupLabels] = useState<Record<string, string>>({});
  const [productLabels, setProductLabels] = useState<Record<string, string>>({});
  const [operativeAddState, setOperativeAddState] = useState<ItemAddState>(defaultAddState);
  const [operativeRates, setOperativeRates] = useState<Record<string, string>>({});
  const [operativeTrades, setOperativeTrades] = useState<Record<string, string>>({});
  const defaultTradeIdRef = useRef<string>("");
  const [ratePrompt, setRatePrompt] = useState<{
    index: number;
    previousRate: string;
    nextRate: string;
  } | null>(null);
  const [certAssignPrompt, setCertAssignPrompt] = useState<{
    indexes: number[];
    operativeId: string;
    operativeLabel: string;
    pickKey?: string;
    warnings: CertificationAssignWarning[];
  } | null>(null);
  const [certAssignChecking, setCertAssignChecking] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  /** Pending operative pick for assigning a package / add-on block (unassigned template lines). */
  const [assignPick, setAssignPick] = useState<Record<string, { id: string; label: string }>>({});
  const previousStatusIdRef = useRef(getValues("statusId") || "");
  const statusBeforeHoldRef = useRef(getValues("statusId") || "");
  const defaultedPendingStatusRef = useRef(false);

  const items = useWatch({ control, name: "items" }) ?? [];

  useEffect(() => {
    if (defaultedPendingStatusRef.current) return;
    const current = getValues("statusId")?.trim() ?? "";
    if (current) {
      defaultedPendingStatusRef.current = true;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const options = await fetchTaskStatusOptions("");
        if (cancelled) return;
        const pending =
          options.find((option) => option.code?.toUpperCase() === "PENDING") ??
          options.find((option) => option.label.trim().toLowerCase() === "pending");
        if (!pending?.value) return;
        if (getValues("statusId")?.trim()) {
          defaultedPendingStatusRef.current = true;
          return;
        }
        setValue("statusId", pending.value, { shouldDirty: false });
        previousStatusIdRef.current = pending.value;
        statusBeforeHoldRef.current = pending.value;
        defaultedPendingStatusRef.current = true;
      } catch {
        // Status default is best-effort; user can still pick manually.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getValues, setValue]);

  useEffect(() => {
    if (disabled || !jobTypeId || !startDate) return;
    const key = `${jobTypeId}|${startDate}`;
    if (templateSeededRef.current === key) return;

    const existing = getValues("items") ?? [];
    const hasPersisted = existing.some((item) => String(item.id || "").trim());
    if (hasPersisted) {
      templateSeededRef.current = key;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const preview = (await jobTypesService.preview(jobTypeId, startDate)).data;
        if (cancelled || !preview) return;
        templateSeededRef.current = key;
        if (preview.handOverDate) {
          setValue("handOverDate", preview.handOverDate.slice(0, 10), { shouldDirty: true });
        }
        const nextTradeLabels: Record<string, string> = {};
        const nextProductLabels: Record<string, string> = {};
        const rows: TaskItemFormValues[] = (preview.items ?? []).map((line) => {
          const tradeGroupId = line.tradeGroupId ? String(line.tradeGroupId) : "";
          const productId = line.productId ? String(line.productId) : "";
          if (tradeGroupId && line.tradeGroupName) {
            nextTradeLabels[tradeGroupId] = line.tradeGroupName;
          }
          if (productId && line.productName) {
            nextProductLabels[productId] = line.productName;
          }
          return {
            ...emptyTaskItem(),
            operativeId: "",
            workDate: line.workDate.slice(0, 10),
            tradeId: line.tradeId != null ? String(line.tradeId) : "",
            itemKind: line.tradeGroupId ? "tradeGroup" : "product",
            tradeGroupId,
            productId,
            quantity: String(line.quantity || 1),
            rate: String(line.rate || 0),
          };
        });
        if (Object.keys(nextTradeLabels).length > 0) {
          setTradeGroupLabels((prev) => ({ ...prev, ...nextTradeLabels }));
        }
        if (Object.keys(nextProductLabels).length > 0) {
          setProductLabels((prev) => ({ ...prev, ...nextProductLabels }));
        }
        replace(rows);
      } catch {
        // Preview is best-effort; backend still generates on create.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [disabled, getValues, jobTypeId, replace, setValue, startDate]);

  useEffect(() => {
    const current = getValues("statusId") || "";
    previousStatusIdRef.current = current;
    if (!holdOpen) {
      statusBeforeHoldRef.current = current;
    }
  }, [selectedLabels?.status, getValues, holdOpen]);

  function clearHoldFields() {
    setValue("holdDate", "");
    setValue("holdReasonId", "");
    setValue("holdNotes", "");
  }

  async function handleStatusSelect(option: SearchableSelectOption) {
    const code = option.code ?? (await getTaskStatusCode(option.value));
    if (isHoldStatusCode(code)) {
      statusBeforeHoldRef.current = previousStatusIdRef.current;
      setHoldOpen(true);
      return;
    }
    clearHoldFields();
    previousStatusIdRef.current = option.value;
  }

  function handleHoldCancel() {
    setValue("statusId", statusBeforeHoldRef.current, { shouldDirty: true });
    previousStatusIdRef.current = statusBeforeHoldRef.current;
    clearHoldFields();
    setHoldOpen(false);
  }

  function handleHoldConfirm(details: HoldDetails) {
    setValue("holdDate", details.holdDate, { shouldDirty: true });
    setValue("holdReasonId", String(details.holdReasonId), { shouldDirty: true });
    setValue("holdNotes", details.holdNotes ?? "", { shouldDirty: true });
    previousStatusIdRef.current = getValues("statusId");
    statusBeforeHoldRef.current = getValues("statusId");
    setHoldOpen(false);
  }

  useEffect(() => {
    for (const item of items) {
      if (!item.id) continue;
      const meta = itemSelectedLabels[item.id];
      if (!meta) continue;
      if (meta.operative && item.operativeId) {
        setOperativeLabels((prev) =>
          prev[item.operativeId] ? prev : { ...prev, [item.operativeId]: meta.operative! },
        );
      }
      if (meta.tradeGroup && item.tradeGroupId) {
        setTradeGroupLabels((prev) =>
          prev[item.tradeGroupId!] ? prev : { ...prev, [item.tradeGroupId!]: meta.tradeGroup! },
        );
      }
      if (meta.product && item.productId) {
        setProductLabels((prev) =>
          prev[item.productId!] ? prev : { ...prev, [item.productId!]: meta.product! },
        );
      }
    }
  }, [items, itemSelectedLabels]);

  useEffect(() => {
    void (async () => {
      if (defaultTradeIdRef.current) return;
      const options = await fetchTradeOptions("");
      defaultTradeIdRef.current = options[0]?.value ?? "";
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; indexes: number[] }>();
    items.forEach((item, index) => {
      const key = item.operativeId || UNASSIGNED_OPERATIVE_KEY;
      const name = item.operativeId
        ? operativeLabels[item.operativeId] ||
          (activeOperativeId === item.operativeId && activeOperativeLabel
            ? activeOperativeLabel
            : `Operative #${item.operativeId}`)
        : "Unassigned";
      const existing = map.get(key);
      if (existing) existing.indexes.push(index);
      else map.set(key, { name, indexes: [index] });
    });
    return Array.from(map.entries());
  }, [items, operativeLabels, activeOperativeId, activeOperativeLabel]);

  function patchAddState(patch: Partial<ItemAddState>) {
    setOperativeAddState((prev) => ({ ...prev, ...patch }));
  }

  async function ensureOperativeMeta(operativeId: string, operativeName?: string) {
    if (!operativeId) return { rate: "0", tradeId: defaultTradeIdRef.current || "" };
    if (!operativeRates[operativeId] || !operativeTrades[operativeId]) {
      const user = (await usersService.get(operativeId)).data;
      const rate = user.dailyRate != null ? String(user.dailyRate) : "0";
      const tradeId = user.tradeId != null ? String(user.tradeId) : "";
      setOperativeRates((prev) => ({ ...prev, [operativeId]: rate }));
      setOperativeTrades((prev) => ({ ...prev, [operativeId]: tradeId }));
      if (operativeName) {
        setOperativeLabels((prev) => ({ ...prev, [operativeId]: operativeName }));
      }
      return { rate, tradeId };
    }
    return {
      rate: operativeRates[operativeId] ?? "0",
      tradeId: operativeTrades[operativeId] ?? "",
    };
  }

  async function addForOperative(operativeId: string) {
    if (itemsLocked) {
      toast.warning("This job is locked. Tick previous-day work before adding items.");
      return;
    }
    if (!operativeId) return;
    const addState = operativeAddState;
    const operativeMeta = await ensureOperativeMeta(
      operativeId,
      operativeLabels[operativeId] ||
        (operativeId === activeOperativeId ? activeOperativeLabel : undefined),
    );

    if (addState.itemKind === "tradeGroup") {
      if (!addState.tradeGroupId) {
        toast.warning("Select a package or add-on first.");
        return;
      }
      const group = (await tradeGroupsService.get(addState.tradeGroupId)).data;
      const groupItems = [...(group.items ?? [])].sort((a, b) => a.orderBy - b.orderBy);
      if (groupItems.length === 0) {
        toast.warning("This package has no products.");
        return;
      }

      const packageLabel = addState.tradeGroupLabel || group.name;
      setTradeGroupLabels((prev) => ({ ...prev, [String(group.id)]: packageLabel }));

      const rows: TaskItemFormValues[] = groupItems.map((groupItem) => {
        const productId = String(groupItem.productId);
        const productName = groupItem.productName?.trim() || `Product ${productId}`;
        setProductLabels((prev) =>
          prev[productId] ? prev : { ...prev, [productId]: productName },
        );
        return {
          ...emptyTaskItem(),
          operativeId,
          tradeId: String(group.tradeId),
          itemKind: "tradeGroup",
          tradeGroupId: String(group.id),
          productId,
          quantity: String(groupItem.quantity > 0 ? groupItem.quantity : 1),
          rate: "0",
          applyRatePermanently: false,
        };
      });
      rows.forEach((row) => append(row));
      return;
    }

    if (!addState.productId) {
      toast.warning("Select a package or add-on first.");
      return;
    }

    const product = (await productsService.get(addState.productId)).data;
    setProductLabels((prev) => ({
      ...prev,
      [addState.productId]: addState.productLabel || product.name,
    }));
    append({
      ...emptyTaskItem(),
      operativeId,
      tradeId: operativeMeta.tradeId || defaultTradeIdRef.current || "",
      itemKind: "product",
      tradeGroupId: "",
      productId: addState.productId,
      quantity: "1",
      rate: "0",
      applyRatePermanently: false,
    });
  }

  function ensureOperativeMetaOnly() {
    if (!activeOperativeId) return;
    setOperativeLabels((prev) => ({
      ...prev,
      [activeOperativeId]: activeOperativeLabel || prev[activeOperativeId] || activeOperativeId,
    }));
    void ensureOperativeMeta(activeOperativeId, activeOperativeLabel);
  }

  async function addFromTop() {
    if (itemsLocked) {
      toast.warning("This job is locked. Tick previous-day work before adding items.");
      return;
    }
    if (!activeOperativeId) {
      toast.warning("Select an operative first.");
      return;
    }
    ensureOperativeMetaOnly();
    await addForOperative(activeOperativeId);
  }

  function applyOperativeAssignment(
    indexes: number[],
    operativeId: string,
    operativeLabel: string,
  ) {
    setOperativeLabels((prev) => ({
      ...prev,
      [operativeId]: operativeLabel || prev[operativeId] || operativeId,
    }));
    for (const index of indexes) {
      setValue(`items.${index}.operativeId`, operativeId, { shouldDirty: true });
    }
  }

  function unassignItems(indexes: number[]) {
    if (itemsLocked) {
      toast.warning("This job is locked. Tick previous-day work before modifying items.");
      return;
    }
    if (indexes.length === 0) return;
    const indexSet = new Set(indexes);
    const current = getValues("items") ?? [];
    replace(
      snapshotItems(current).map((row, index) =>
        indexSet.has(index) ? { ...row, operativeId: "" } : row,
      ),
    );
  }

  async function assignItemsToOperative(
    indexes: number[],
    operativeId: string,
    operativeLabel: string,
    pickKey?: string,
  ) {
    if (itemsLocked) {
      toast.warning("This job is locked. Tick previous-day work before assigning items.");
      if (pickKey) {
        setAssignPick((prev) => {
          const next = { ...prev };
          delete next[pickKey];
          return next;
        });
      }
      return;
    }
    if (!operativeId) {
      toast.warning("Select an operative first.");
      return;
    }
    if (indexes.length === 0) return;

    setCertAssignChecking(true);
    try {
      const certifications =
        (await usersService.getAssignCertifications(operativeId)).data ?? [];

      const workDates = indexes.map((index) => getValues(`items.${index}.workDate`));
      const warnings = findCertificationWarningsForWorkDates(certifications, workDates);

      if (warnings.length > 0) {
        setCertAssignPrompt({
          indexes,
          operativeId,
          operativeLabel,
          pickKey,
          warnings,
        });
        return;
      }

      applyOperativeAssignment(indexes, operativeId, operativeLabel);
      if (pickKey) {
        setAssignPick((prev) => {
          const next = { ...prev };
          delete next[pickKey];
          return next;
        });
      }
    } catch (err) {
      notifyApiError(err, "Unable to check operative certificates");
      if (pickKey) {
        setAssignPick((prev) => {
          const next = { ...prev };
          delete next[pickKey];
          return next;
        });
      }
    } finally {
      setCertAssignChecking(false);
    }
  }

  function confirmCertAssign() {
    if (!certAssignPrompt) return;
    const { indexes, operativeId, operativeLabel, pickKey } = certAssignPrompt;
    applyOperativeAssignment(indexes, operativeId, operativeLabel);
    if (pickKey) {
      setAssignPick((prev) => {
        const next = { ...prev };
        delete next[pickKey];
        return next;
      });
    }
    setCertAssignPrompt(null);
  }

  function cancelCertAssign() {
    if (certAssignPrompt?.pickKey) {
      const pickKey = certAssignPrompt.pickKey;
      setAssignPick((prev) => {
        const next = { ...prev };
        delete next[pickKey];
        return next;
      });
    }
    setCertAssignPrompt(null);
  }

  function renderAssignOperativeControls(pickKey: string, indexes: number[]) {
    const pick = assignPick[pickKey] ?? { id: "", label: "" };
    return (
      <div className="flex min-w-0 items-center">
        <div className="w-[175px] shrink-0">
          <label className="sr-only">Operative</label>
          <SearchableSelect
            value={pick.id}
            onValueChange={(value) =>
              setAssignPick((prev) => ({
                ...prev,
                [pickKey]: { id: value, label: prev[pickKey]?.label ?? "" },
              }))
            }
            onSelect={(opt) => {
              setAssignPick((prev) => ({
                ...prev,
                [pickKey]: { id: opt.value, label: opt.label },
              }));
              if (opt.value) {
                void assignItemsToOperative(indexes, opt.value, opt.label, pickKey);
              }
            }}
            placeholder="Select operative"
            searchPlaceholder="Search operatives…"
            queryKey={["lookups", "operatives", "assign", pickKey]}
            fetchOptions={fetchOperativeOptions}
            selectedLabel={pick.label || null}
            disabled={addControlsDisabled || certAssignChecking}
            triggerClassName="h-8 text-xs"
          />
        </div>
      </div>
    );
  }

  function renderTopAddControls() {
    const addState = operativeAddState;
    const selectionValue = packageOrAddonSelectionValue(
      addState.itemKind,
      addState.itemKind === "tradeGroup" ? addState.tradeGroupId : addState.productId,
    );
    const selectionLabel =
      addState.itemKind === "tradeGroup"
        ? addState.tradeGroupLabel || null
        : addState.productLabel || null;
    const canAdd =
      Boolean(activeOperativeId) &&
      (addState.itemKind === "tradeGroup"
        ? Boolean(addState.tradeGroupId)
        : Boolean(addState.productId));

    function applyPackageOrAddonSelection(value: string, label: string) {
      const parsed = parsePackageOrAddonValue(value);
      if (!parsed) {
        patchAddState({
          itemKind: "tradeGroup",
          tradeGroupId: "",
          tradeGroupLabel: "",
          productId: "",
          productLabel: "",
        });
        return;
      }
      if (parsed.kind === "tradeGroup") {
        patchAddState({
          itemKind: "tradeGroup",
          tradeGroupId: parsed.id,
          tradeGroupLabel: label,
          productId: "",
          productLabel: "",
        });
        return;
      }
      patchAddState({
        itemKind: "product",
        productId: parsed.id,
        productLabel: label,
        tradeGroupId: "",
        tradeGroupLabel: "",
      });
    }

    return (
      <div className="flex w-full min-w-0 flex-wrap items-end gap-2">
        <div className="w-[160px] shrink-0">
          <label className="mb-0.5 block text-[11px] text-muted-foreground">Active operative</label>
          <SearchableSelect
            value={activeOperativeId}
            onValueChange={setActiveOperativeId}
            onSelect={(opt) => {
              setActiveOperativeLabel(opt.label);
              if (opt.value) {
                setOperativeLabels((prev) => ({ ...prev, [opt.value]: opt.label }));
                void ensureOperativeMeta(opt.value, opt.label);
              }
            }}
            placeholder="Select operative"
            searchPlaceholder="Search operatives…"
            queryKey={["lookups", "operatives", "active"]}
            fetchOptions={fetchOperativeOptions}
            selectedLabel={activeOperativeLabel || null}
            disabled={addControlsDisabled}
            triggerClassName="h-8 text-xs"
          />
        </div>
        <div className="w-[220px] shrink-0">
          <label className="mb-0.5 block text-[11px] text-muted-foreground">Package / Add-on</label>
          <SearchableSelect
            value={selectionValue}
            onValueChange={(value) => {
              if (!value) {
                patchAddState({
                  itemKind: "tradeGroup",
                  tradeGroupId: "",
                  tradeGroupLabel: "",
                  productId: "",
                  productLabel: "",
                });
              }
            }}
            onSelect={(opt) => applyPackageOrAddonSelection(opt.value, opt.label)}
            placeholder="Select package or add-on"
            searchPlaceholder="Search packages & add-ons…"
            queryKey={["lookups", "packages-or-addons"]}
            fetchOptions={fetchPackageOrAddonOptions}
            selectedLabel={selectionLabel}
            disabled={addControlsDisabled}
            triggerClassName="h-8 text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 px-2.5 text-xs"
          onClick={() => void addFromTop()}
          disabled={!canAdd || addControlsDisabled}
        >
          <Plus className="h-3.5 w-3.5" />
          Add item
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setShowAddComposer(false)}
          aria-label="Close add item"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const operativeCards = useMemo(() => {
    const ids: string[] = [];
    let hasUnassigned = false;
    for (const [key] of grouped) {
      if (key === UNASSIGNED_OPERATIVE_KEY) {
        hasUnassigned = true;
        continue;
      }
      ids.push(key);
    }
    // Template-seeded lines (no operative yet) still need a visible card.
    if (hasUnassigned) ids.unshift(UNASSIGNED_OPERATIVE_KEY);
    return ids;
  }, [grouped]);

  function removeItem(index: number) {
    if (itemsLocked) {
      toast.warning("This job is locked. Tick previous-day work before modifying items.");
      return;
    }
    const current = getValues("items") ?? [];
    if (index < 0 || index >= current.length) return;
    const next = snapshotItems(current.filter((_, i) => i !== index));
    unregister(`items.${index}`);
    replace(next);
    setValue("items", next, { shouldDirty: true });
  }

  function resolveRatePrompt(permanent: boolean) {
    if (!ratePrompt) return;
    setValue(`items.${ratePrompt.index}.rate`, ratePrompt.nextRate, { shouldDirty: true });
    setValue(`items.${ratePrompt.index}.applyRatePermanently`, permanent, { shouldDirty: true });
    setRatePrompt(null);
  }

  function cancelRatePrompt() {
    if (!ratePrompt) return;
    setValue(`items.${ratePrompt.index}.rate`, ratePrompt.previousRate, { shouldDirty: true });
    setValue(`items.${ratePrompt.index}.applyRatePermanently`, false, { shouldDirty: true });
    setRatePrompt(null);
  }

  const jobItemsTotal = items.reduce((sum, item) => {
    const qty = Number(item?.quantity || 0);
    const rate = Number(item?.rate || 0);
    const line = qty * rate;
    return sum + (Number.isFinite(line) ? line : 0);
  }, 0);

  return (
    <>
      <fieldset disabled={disabled} className="min-w-0 w-full max-w-full space-y-2.5">
        <div
          className={
            embedded
              ? "min-w-0 w-full space-y-2"
              : "card-elevated min-w-0 w-full space-y-2 overflow-hidden p-3"
          }
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 [&>*]:min-w-0">
            <div className="sm:col-span-4">
              <CreatableSearchableSelectField<TaskFormValues>
                name="propertyId"
                label="Property"
                required
                placeholder="Select property"
                searchPlaceholder="Search properties…"
                queryKey={["lookups", "properties"]}
                selectedLabel={selectedLabels?.property}
                fetchOptions={fetchPropertyOptions}
                lookupType="property"
                className="min-w-0"
                triggerClassName="h-8.5 text-xs"
              />
            </div>
            <div className="sm:col-span-4">
              <CreatableSearchableSelectField<TaskFormValues>
                name="jobTypeId"
                label="Property type"
                required
                placeholder="Select property type"
                searchPlaceholder="Search property types…"
                queryKey={["lookups", "job-types"]}
                selectedLabel={selectedLabels?.jobType}
                fetchOptions={fetchJobTypeOptions}
                lookupType="jobType"
                className="min-w-0"
                triggerClassName="h-8.5 text-xs"
              />
            </div>
            <div className="sm:col-span-4">
              <TextField<TaskFormValues>
                name="startDate"
                label="Start date"
                type="date"
                required
                className="min-w-0"
                inputClassName="h-8.5 min-w-0 text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <TextField<TaskFormValues>
                name="handOverDate"
                label="Hand over date"
                description="Auto from property type"
                type="date"
                className="min-w-0"
                inputClassName="h-8.5 min-w-0 text-xs"
                disabled
              />
            </div>
            <div className="sm:col-span-3">
              <CreatableSearchableSelectField<TaskFormValues>
                name="statusId"
                label="Status"
                required
                placeholder="Select status"
                searchPlaceholder="Search statuses…"
                queryKey={["lookups", "statuses", "TASK"]}
                selectedLabel={selectedLabels?.status}
                fetchOptions={fetchTaskStatusOptions}
                onSelect={handleStatusSelect}
                lookupType="status"
                className="min-w-0"
                triggerClassName="h-8.5 text-xs"
              />
            </div>
            <div className="sm:col-span-6">
              <TextareaField<TaskFormValues>
                name="description"
                label="Description"
                rows={2}
                maxLength={DESCRIPTION_MAX_LENGTH}
                className="min-w-0 w-full"
              />
            </div>
          </div>
          {/* Temporarily hidden: Budget — re-enable when needed */}
          {false && (
            <TextField<TaskFormValues>
              name="budget"
              label="Budget"
              placeholder="1000"
              description="Job budget"
              className="min-w-0"
              inputClassName="h-10 min-w-0"
              leftIcon={({ className }) => (
                <span className={cn(className, "text-sm font-semibold leading-none")}>£</span>
              )}
            />
          )}
          {/* Temporarily hidden: Site Manager is assigned from the project Assign To field */}
          {false && (
            <CreatableSearchableSelectField<TaskFormValues>
              name="siteManagerId"
              label="Site Manager"
              placeholder="Select Site Manager"
              searchPlaceholder="Search Site Managers"
              queryKey={["lookups", "site-managers"]}
              selectedLabel={selectedLabels?.siteManager}
              fetchOptions={fetchSiteManagerOptions}
              emptyOption={{ value: "", label: "None" }}
              lookupType="siteManager"
            />
          )}
        </div>

        {/* Job items — auto-filled from JobType template; SM can edit */}
        <div className={embedded ? "min-w-0 space-y-2 border-t border-border pt-3" : "min-w-0 space-y-2"}>
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              {itemsLocked ? (
                <p className="text-xs font-medium text-warning-foreground">
                  Locked — tick at least one item on the previous working day before adding new
                  items.
                </p>
              ) : null}
              {!addControlsDisabled ? (
                showAddComposer ? (
                  renderTopAddControls()
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => setShowAddComposer(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add more
                  </Button>
                )
              ) : null}
            </div>
          </div>

          {operativeCards.length === 0 ? (
            <div className="card-elevated p-3 text-sm text-muted-foreground">
              No job items yet. Select a property type with a template, or use Add more to choose an
              operative and package / add-on.
            </div>
          ) : null}

          {operativeCards.map((operativeId) => {
            const isUnassigned = operativeId === UNASSIGNED_OPERATIVE_KEY;
            const groupEntry = grouped.find(([key]) => key === operativeId);
            const indexes = groupEntry?.[1].indexes ?? [];
            const name = isUnassigned
              ? "Unassigned"
              : operativeLabels[operativeId] ||
                (operativeId === activeOperativeId
                  ? activeOperativeLabel
                  : `Operative #${operativeId}`);
            const operativeTotal = indexes.reduce((sum, index) => {
              const qty = Number(items[index]?.quantity || 0);
              const rate = Number(items[index]?.rate || 0);
              const line = qty * rate;
              return sum + (Number.isFinite(line) ? line : 0);
            }, 0);
            const isAllDone =
              indexes.length > 0 && indexes.every((idx) => Number(items[idx]?.doneQty || 0) > 0);

            return (
              <div
                key={operativeId}
                className="card-elevated min-w-0 space-y-1.5 overflow-hidden p-2.5"
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-medium leading-tight">{name}</h4>
                  <div className="flex shrink-0 items-center gap-2">
                    {indexes.length > 0 ? (
                      <div className="flex items-baseline gap-1.5 text-xs">
                        <span className="text-muted-foreground">
                          {indexes.length} item{indexes.length === 1 ? "" : "s"}
                        </span>
                        <AppTooltip content={fmtGBP(operativeTotal)} asChild align="end">
                          <span className="font-display font-semibold tabular-nums">
                            {fmtGBP(operativeTotal)}
                          </span>
                        </AppTooltip>
                      </div>
                    ) : null}
                    {isUnassigned && indexes.length > 0 ? (
                      renderAssignOperativeControls(`ops-${operativeId}`, indexes)
                    ) : null}
                    {!isUnassigned && indexes.length > 0 && !isAllDone ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => unassignItems(indexes)}
                        disabled={disabled || itemsLocked}
                      >
                        <Undo2 className="h-3.5 w-3.5" aria-hidden />
                        Unassign
                      </Button>
                    ) : null}
                  </div>
                </div>

                {indexes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No lines yet. Use Add more above to choose an operative and package / add-on.
                  </p>
                ) : (
                  <div className="min-w-0">
                    <ProductLinesTable
                      indexes={indexes}
                      fields={fields}
                      items={items}
                      productLabels={productLabels}
                      removeDisabled={disabled || itemsLocked}
                      onRemove={removeItem}
                      onRateCommit={(index, previousRate, nextRate) => {
                        if (previousRate === nextRate) return;
                        setValue(`items.${index}.rate`, nextRate);
                        setRatePrompt({ index, previousRate, nextRate });
                      }}
                      getValues={getValues}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {items.length > 0 ? (
            <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
              <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
                <AppTooltip content={fmtGBP(jobItemsTotal)} asChild align="end">
                  <span className="font-display text-base font-semibold tabular-nums whitespace-nowrap">
                    Total {fmtGBP(jobItemsTotal)}
                  </span>
                </AppTooltip>
              </div>
            </div>
          ) : null}
        </div>

        {ratePrompt ? (
          <Modal
            open
            onClose={cancelRatePrompt}
            title="Apply rate change?"
            subtitle="Choose whether this rate update is one-off or permanent for the product catalogue."
            size="sm"
            showCloseButton={false}
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                New rate: £{Number(ratePrompt.nextRate || 0).toFixed(2)}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => resolveRatePrompt(false)}
                >
                  Apply this time only
                </Button>
                <Button type="button" size="sm" onClick={() => resolveRatePrompt(true)}>
                  Save as permanent product rate
                </Button>
              </div>
            </div>
          </Modal>
        ) : null}

        {certAssignPrompt ? (
          <Modal
            open
            onClose={cancelCertAssign}
            title="Certificate expiry warning"
            subtitle={formatCertificationWarningSubtitle(
              certAssignPrompt.operativeLabel,
              certAssignPrompt.warnings,
            )}
            size="sm"
            showCloseButton={false}
          >
            <div className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                {certAssignPrompt.warnings.map((w) => (
                  <li
                    key={`${w.name}-${w.expiryDate}`}
                    className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 font-medium text-foreground">{w.name}</span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums text-xs font-medium",
                        w.isExpired
                          ? "text-destructive"
                          : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {w.statusLabel || (w.isExpired ? `Expired ${w.displayExpiry}` : `Expires ${w.displayExpiry}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={cancelCertAssign}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={confirmCertAssign}>
                  Confirm assign
                </Button>
              </div>
            </div>
          </Modal>
        ) : null}
      </fieldset>

      <HoldDetailsModal
        open={holdOpen}
        onClose={handleHoldCancel}
        onConfirm={handleHoldConfirm}
      />
    </>
  );
}

const PRODUCT_LINE_TABLE_MIN_WIDTH = "736px";

function ProductLinesTable({
  indexes,
  fields,
  items,
  productLabels,
  removeDisabled = false,
  onRemove,
  onRateCommit,
  getValues,
}: {
  indexes: number[];
  fields: { fieldKey: string }[];
  items: TaskFormValues["items"];
  productLabels: Record<string, string>;
  removeDisabled?: boolean;
  onRemove: (index: number) => void;
  onRateCommit: (index: number, previousRate: string, nextRate: string) => void;
  getValues: ReturnType<typeof useFormContext<TaskFormValues>>["getValues"];
}) {
  const { setValue, control } = useFormContext<TaskFormValues>();
  const timeSlotsQuery = useQuery({
    queryKey: ["lookups", "time-slots"],
    queryFn: async () => (await tasksService.timeSlots()).data ?? [],
  });

  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-md border border-border/60">
      <table
        className="w-full table-fixed text-xs"
        style={{ minWidth: PRODUCT_LINE_TABLE_MIN_WIDTH }}
      >
        <colgroup>
          <col style={{ width: "120px" }} />
          <col style={{ width: "132px" }} />
          <col style={{ width: "96px" }} />
          <col style={{ width: "56px" }} />
          <col style={{ width: "72px" }} />
          <col style={{ width: "64px" }} />
          <col />
          <col style={{ width: "56px" }} />
        </colgroup>
        <thead>
          <tr className="border-b bg-muted/20 text-left text-muted-foreground">
            <th className="px-1.5 py-1 text-[11px] font-medium">Product</th>
            <th className="px-1.5 py-1 text-[11px] font-medium">Work date</th>
            <th className="px-1.5 py-1 text-[11px] font-medium">Time</th>
            <th className="px-1.5 py-1 text-[11px] font-medium">Qty</th>
            <th className="px-1.5 py-1 text-[11px] font-medium">Rate</th>
            <th className="px-1.5 py-1 text-[11px] font-medium">Amount</th>
            <th className="px-1.5 py-1 text-[11px] font-medium">Notes</th>
            <th className="px-0.5 py-1 text-[11px] font-medium" />
          </tr>
        </thead>
        <tbody>
          {indexes.map((index) => {
            const fieldId = fields[index]?.fieldKey ?? `item-${index}`;
            return (
            <ProductLineRow
              key={fieldId}
              fieldId={fieldId}
              index={index}
              item={items[index]}
              productLabel={
                items[index]?.productId
                  ? productLabels[items[index].productId] || `Product #${items[index].productId}`
                  : "—"
              }
              timeSlots={timeSlotsQuery.data ?? []}
              setValue={setValue}
              control={control}
              getValues={getValues}
              onRemove={() => onRemove(index)}
              removeDisabled={removeDisabled}
              onRateCommit={onRateCommit}
            />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductLineRow({
  fieldId,
  index,
  item,
  productLabel,
  timeSlots,
  setValue,
  control,
  getValues,
  onRemove,
  removeDisabled = false,
  onRateCommit,
}: {
  fieldId: string;
  index: number;
  item: TaskFormValues["items"][number];
  productLabel: string;
  timeSlots: { id: number; name: string }[];
  setValue: ReturnType<typeof useFormContext<TaskFormValues>>["setValue"];
  control: ReturnType<typeof useFormContext<TaskFormValues>>["control"];
  getValues: ReturnType<typeof useFormContext<TaskFormValues>>["getValues"];
  onRemove: () => void;
  removeDisabled?: boolean;
  onRateCommit: (index: number, previousRate: string, nextRate: string) => void;
}) {
  const workDate = String(useWatch({ control, name: `items.${index}.workDate` }) ?? "");
  const timeSlotId = String(useWatch({ control, name: `items.${index}.timeSlotId` }) ?? "");
  const quantity = Number(useWatch({ control, name: `items.${index}.quantity` }) || 0);
  const quantityValue = String(useWatch({ control, name: `items.${index}.quantity` }) ?? "");
  const rateValue = String(useWatch({ control, name: `items.${index}.rate` }) ?? "");
  const rate = Number(rateValue || 0);
  const notes = String(useWatch({ control, name: `items.${index}.notes` }) ?? "");
  const amount = Number.isFinite(quantity * rate) ? quantity * rate : 0;
  const rateBeforeEdit = useRef(item?.rate ?? "0");

  useEffect(() => {
    rateBeforeEdit.current = getValues(`items.${index}.rate`) || "0";
  }, [getValues, index, item?.id, item?.productId, fieldId]);

  useEffect(() => {
    const current = getValues(`items.${index}.timeSlotId`);
    if (!current && timeSlots.length > 0) {
      setValue(`items.${index}.timeSlotId`, String(timeSlots[0].id), { shouldDirty: false });
    }
  }, [fieldId, getValues, index, setValue, timeSlots]);

  const doneQty = Number(useWatch({ control, name: `items.${index}.doneQty` }) || item?.doneQty || 0);
  const isDone = doneQty > 0;

  return (
    <tr className="align-middle border-b border-border/50">
      <td className="min-w-0 px-1.5 py-1.5 font-medium">
        <TruncatedTooltip text={productLabel} maxChars={22} />
      </td>
      <td className="px-1.5 py-1.5">
        <input
          key={`${fieldId}-workDate`}
          type="date"
          className="h-7 w-[124px] max-w-full rounded-md border border-input bg-background px-1.5 text-xs"
          value={workDate}
          onChange={(event) =>
            setValue(`items.${index}.workDate`, event.target.value, { shouldDirty: true })
          }
        />
      </td>
      <td className="px-1.5 py-1.5">
        <select
          key={`${fieldId}-timeSlot`}
          className="h-7 w-[88px] max-w-full rounded-md border border-input bg-background px-1 text-xs"
          value={timeSlotId}
          onChange={(event) =>
            setValue(`items.${index}.timeSlotId`, event.target.value, { shouldDirty: true })
          }
        >
          <option value="">Select…</option>
          {timeSlots.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1.5 py-1.5">
        <input
          key={`${fieldId}-qty`}
          type="number"
          min={0.01}
          step={0.01}
          className="h-7 w-[52px] max-w-full rounded-md border border-input bg-background px-1 text-xs"
          value={quantityValue}
          onChange={(event) =>
            setValue(`items.${index}.quantity`, event.target.value, { shouldDirty: true })
          }
        />
      </td>
      <td className="px-1.5 py-1.5">
        <input
          key={`${fieldId}-rate`}
          type="number"
          min={0}
          step={0.01}
          className="h-7 w-[64px] max-w-full rounded-md border border-input bg-background px-1 text-xs"
          value={rateValue}
          onChange={(event) =>
            setValue(`items.${index}.rate`, event.target.value, { shouldDirty: true })
          }
          onFocus={() => {
            rateBeforeEdit.current = getValues(`items.${index}.rate`) || "0";
          }}
          onBlur={(event) => {
            const nextRate = event.target.value;
            const previousRate = rateBeforeEdit.current;
            if (nextRate !== previousRate) {
              onRateCommit(index, previousRate, nextRate);
            } else {
              setValue(`items.${index}.applyRatePermanently`, false);
            }
          }}
        />
      </td>
      <td className="px-1.5 py-1.5 font-medium">
        <AppTooltip content={fmtGBP(amount)} asChild align="end">
          <span className="inline-block tabular-nums text-xs">{fmtGBP(amount)}</span>
        </AppTooltip>
      </td>
      <td className="min-w-0 px-1.5 py-1.5">
        <AppTooltip
          content={notes.trim() || undefined}
          disabled={!notes.trim()}
          asChild
          align="start"
        >
          <div className="min-w-0 w-full">
            <input
              key={`${fieldId}-notes`}
              type="text"
              className="h-7 w-full min-w-[140px] truncate rounded-md border border-input bg-background px-1.5 text-xs"
              placeholder="Notes"
              value={notes}
              onChange={(event) =>
                setValue(`items.${index}.notes`, event.target.value, { shouldDirty: true })
              }
            />
          </div>
        </AppTooltip>
      </td>
      <td className="px-0.5 py-1.5">
        {!isDone ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            onClick={() => onRemove()}
            disabled={removeDisabled}
            aria-label="Remove item"
            title="Remove item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function TruncatedTooltip({ text, maxChars = 24 }: { text: string; maxChars?: number }) {
  const value = text.trim();
  if (!value) return <span>—</span>;
  const truncated = truncateWithEllipsis(value, maxChars);
  const label = <span className="block min-w-0 max-w-[8.5rem] truncate">{truncated}</span>;
  return (
    <AppTooltip content={value} asChild align="start">
      <span className="block min-w-0 max-w-[8.5rem] cursor-default">{label}</span>
    </AppTooltip>
  );
}
