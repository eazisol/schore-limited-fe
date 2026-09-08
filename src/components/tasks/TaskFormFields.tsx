import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useEffect, useMemo, useRef, useState } from "react";
import { TextField, TextareaField, CreatableSearchableSelectField } from "@/components/form";
import { SearchableSelect } from "@/components/form/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/Modal";
import { AppTooltip } from "@/components/AppTooltip";
import { Calculator, Plus, Trash2 } from "lucide-react";
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
  fetchPackageOptions,
  fetchProductOptions,
  fetchPropertyOptions,
  fetchSiteManagerOptions,
  fetchTaskStatusOptions,
  fetchTradeOptions,
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

const ADD_AS_OPTIONS: SearchableSelectOption[] = [
  { value: "tradeGroup", label: "Package" },
  { value: "product", label: "Add-on" },
];

/** Form grouping key for template lines that have no operative yet. */
const UNASSIGNED_OPERATIVE_KEY = "__unassigned";

async function fetchAddAsOptions(search: string): Promise<SearchableSelectOption[]> {
  const q = search.trim().toLowerCase();
  if (!q) return ADD_AS_OPTIONS;
  return ADD_AS_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(q));
}

function addAsLabel(itemKind: "tradeGroup" | "product") {
  return itemKind === "tradeGroup" ? "Package" : "Add-on product";
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

type OperativeAddState = {
  itemKind: "tradeGroup" | "product";
  tradeGroupId: string;
  tradeGroupLabel: string;
  productId: string;
  productLabel: string;
};

const defaultAddState = (): OperativeAddState => ({
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
  const { control, setValue, getValues } = useFormContext<TaskFormValues>();
  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
  const addControlsDisabled = disabled || itemsLocked;
  const jobTypeId = useWatch({ control, name: "jobTypeId" });
  const startDate = useWatch({ control, name: "startDate" });
  const templateSeededRef = useRef<string>("");
  const [activeOperativeId, setActiveOperativeId] = useState<string>("");
  const [activeOperativeLabel, setActiveOperativeLabel] = useState<string>("");
  const [operativeLabels, setOperativeLabels] = useState<Record<string, string>>({});
  const [tradeGroupLabels, setTradeGroupLabels] = useState<Record<string, string>>({});
  const [productLabels, setProductLabels] = useState<Record<string, string>>({});
  const [operativeAddState, setOperativeAddState] = useState<Record<string, OperativeAddState>>({});
  const [operativeRates, setOperativeRates] = useState<Record<string, string>>({});
  const [operativeTrades, setOperativeTrades] = useState<Record<string, string>>({});
  const defaultTradeIdRef = useRef<string>("");
  const [ratePrompt, setRatePrompt] = useState<{
    index: number;
    previousRate: string;
    nextRate: string;
  } | null>(null);
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
            tradeId: String(line.tradeId),
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

  function getAddState(operativeId: string): OperativeAddState {
    return operativeAddState[operativeId] ?? defaultAddState();
  }

  function patchAddState(operativeId: string, patch: Partial<OperativeAddState>) {
    setOperativeAddState((prev) => ({
      ...prev,
      [operativeId]: { ...(prev[operativeId] ?? defaultAddState()), ...patch },
    }));
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
    const addState = getAddState(operativeId);
    const operativeMeta = await ensureOperativeMeta(
      operativeId,
      operativeLabels[operativeId] ||
        (operativeId === activeOperativeId ? activeOperativeLabel : undefined),
    );

    if (addState.itemKind === "tradeGroup") {
      if (!addState.tradeGroupId) {
        toast.warning("Select a package first.");
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
      toast.warning("Select an add-on product first.");
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

  async function assignItemsToOperative(
    indexes: number[],
    operativeId: string,
    operativeLabel: string,
  ) {
    if (itemsLocked) {
      toast.warning("This job is locked. Tick previous-day work before assigning items.");
      return;
    }
    if (!operativeId) {
      toast.warning("Select an operative first.");
      return;
    }
    if (indexes.length === 0) return;

    setOperativeLabels((prev) => ({
      ...prev,
      [operativeId]: operativeLabel || prev[operativeId] || operativeId,
    }));
    await ensureOperativeMeta(operativeId, operativeLabel);

    for (const index of indexes) {
      setValue(`items.${index}.operativeId`, operativeId, { shouldDirty: true });
    }
  }

  function renderAssignOperativeControls(pickKey: string, indexes: number[]) {
    const pick = assignPick[pickKey] ?? { id: "", label: "" };
    return (
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <div className="w-[180px] shrink-0">
          <label className="mb-1 block text-xs text-muted-foreground">Operative</label>
          <SearchableSelect
            value={pick.id}
            onValueChange={(value) =>
              setAssignPick((prev) => ({
                ...prev,
                [pickKey]: { id: value, label: prev[pickKey]?.label ?? "" },
              }))
            }
            onSelect={(opt) =>
              setAssignPick((prev) => ({
                ...prev,
                [pickKey]: { id: opt.value, label: opt.label },
              }))
            }
            placeholder="Select operative"
            searchPlaceholder="Search operatives…"
            queryKey={["lookups", "operatives", "assign", pickKey]}
            fetchOptions={fetchOperativeOptions}
            selectedLabel={pick.label || null}
            disabled={addControlsDisabled}
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={!pick.id || addControlsDisabled}
          onClick={() => {
            void (async () => {
              await assignItemsToOperative(indexes, pick.id, pick.label);
              setAssignPick((prev) => {
                const next = { ...prev };
                delete next[pickKey];
                return next;
              });
            })();
          }}
        >
          Assign
        </Button>
      </div>
    );
  }

  function renderAddControls(
    operativeId: string,
    options?: {
      addButtonLabel?: string;
      querySuffix?: string;
      includeOperative?: boolean;
      className?: string;
    },
  ) {
    const addState = getAddState(operativeId);
    const addButtonLabel = options?.addButtonLabel ?? "Add for this operative";
    const querySuffix = options?.querySuffix ?? operativeId;
    const includeOperative = options?.includeOperative ?? false;
    const canAdd =
      Boolean(operativeId) &&
      (addState.itemKind === "tradeGroup"
        ? Boolean(addState.tradeGroupId)
        : Boolean(addState.productId));

    return (
      <div
        className={cn(
          "flex w-full min-w-0 flex-wrap items-end justify-between gap-3",
          options?.className,
        )}
      >
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          {includeOperative ? (
            <div className="w-[180px] shrink-0">
              <label className="mb-1 block text-xs text-muted-foreground">Active operative</label>
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
              />
            </div>
          ) : null}
          <div className="w-[180px] shrink-0">
            <label className="mb-1 block text-xs text-muted-foreground">Add as</label>
            <SearchableSelect
              value={addState.itemKind}
              onValueChange={(value) => {
                const kind = (value || "tradeGroup") as "tradeGroup" | "product";
                patchAddState(operativeId, {
                  itemKind: kind,
                  tradeGroupId: "",
                  tradeGroupLabel: "",
                  productId: "",
                  productLabel: "",
                });
              }}
              onSelect={(opt) => {
                const kind = (opt.value || "tradeGroup") as "tradeGroup" | "product";
                patchAddState(operativeId, {
                  itemKind: kind,
                  tradeGroupId: "",
                  tradeGroupLabel: "",
                  productId: "",
                  productLabel: "",
                });
              }}
              placeholder="Select type"
              searchPlaceholder="Search add type…"
              queryKey={["lookups", "add-as", querySuffix]}
              fetchOptions={fetchAddAsOptions}
              selectedLabel={addAsLabel(addState.itemKind)}
              disabled={!operativeId || addControlsDisabled}
            />
          </div>
          <div className="w-[180px] shrink-0">
            <label className="mb-1 block text-xs text-muted-foreground">Package / Add-on</label>
            {addState.itemKind === "tradeGroup" ? (
              <SearchableSelect
                value={addState.tradeGroupId}
                onValueChange={(value) => patchAddState(operativeId, { tradeGroupId: value })}
                onSelect={(opt) =>
                  patchAddState(operativeId, {
                    tradeGroupId: opt.value,
                    tradeGroupLabel: opt.label,
                  })
                }
                placeholder="Select package"
                searchPlaceholder="Search packages…"
                queryKey={["lookups", "packages", "catalogue", querySuffix]}
                fetchOptions={fetchPackageOptions}
                selectedLabel={addState.tradeGroupLabel || null}
                disabled={!operativeId || addControlsDisabled}
              />
            ) : (
              <SearchableSelect
                value={addState.productId}
                onValueChange={(value) => patchAddState(operativeId, { productId: value })}
                onSelect={(opt) =>
                  patchAddState(operativeId, {
                    productId: opt.value,
                    productLabel: opt.label,
                  })
                }
                placeholder="Select add-on"
                searchPlaceholder="Search add-ons…"
                queryKey={["lookups", "active-products", querySuffix]}
                fetchOptions={fetchProductOptions}
                selectedLabel={addState.productLabel || null}
                disabled={!operativeId || addControlsDisabled}
              />
            )}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          variant={options?.addButtonLabel ? "default" : "outline"}
          onClick={() =>
            void (options?.addButtonLabel ? addFromTop() : addForOperative(operativeId))
          }
          disabled={!canAdd || addControlsDisabled}
        >
          <Plus className="h-4 w-4" />
          {addButtonLabel}
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

  function packageGroupsForOperative(indexes: number[]) {
    const packages = new Map<string, { name: string; indexes: number[] }>();
    const addOns: number[] = [];
    for (const index of indexes) {
      const item = items[index];
      if (item?.tradeGroupId) {
        const key = item.tradeGroupId;
        const name = tradeGroupLabels[key] || `Package #${key}`;
        const existing = packages.get(key);
        if (existing) existing.indexes.push(index);
        else packages.set(key, { name, indexes: [index] });
      } else {
        addOns.push(index);
      }
    }

    const workDateValue = (index: number) => {
      const raw = items[index]?.workDate?.trim() ?? "";
      if (!raw) return 0;
      const time = new Date(`${raw.slice(0, 10)}T12:00:00`).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    const sortIndexesByLatestDate = (list: number[]) =>
      [...list].sort((a, b) => {
        const dateDiff = workDateValue(b) - workDateValue(a);
        return dateDiff !== 0 ? dateDiff : b - a;
      });

    const sortedPackages = Array.from(packages.entries())
      .map(([id, pkg]) => {
        const sortedIndexes = sortIndexesByLatestDate(pkg.indexes);
        const latestDate = sortedIndexes.reduce(
          (max, index) => Math.max(max, workDateValue(index)),
          0,
        );
        return [id, { ...pkg, indexes: sortedIndexes, latestDate }] as const;
      })
      .sort((a, b) => {
        const dateDiff = b[1].latestDate - a[1].latestDate;
        return dateDiff !== 0 ? dateDiff : Number(b[0]) - Number(a[0]);
      })
      .map(([id, pkg]) => [id, { name: pkg.name, indexes: pkg.indexes }] as const);

    return {
      packages: sortedPackages,
      addOns: sortIndexesByLatestDate(addOns),
    };
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

  return (
    <>
      <fieldset disabled={disabled} className="min-w-0 w-full max-w-full space-y-3">
        <div
          className={
            embedded
              ? "min-w-0 space-y-3"
              : "card-elevated min-w-0 space-y-3 overflow-hidden p-4 sm:p-6"
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
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
            />
            <CreatableSearchableSelectField<TaskFormValues>
              name="jobTypeId"
              label="Job type"
              required
              placeholder="Select job type"
              searchPlaceholder="Search job types…"
              queryKey={["lookups", "job-types"]}
              selectedLabel={selectedLabels?.jobType}
              fetchOptions={fetchJobTypeOptions}
              lookupType="jobType"
            />
            <TextField<TaskFormValues>
              name="startDate"
              label="Start date"
              type="date"
              required
              className="min-w-0"
              inputClassName="h-10 min-w-0"
            />
            <TextField<TaskFormValues>
              name="handOverDate"
              label="Hand over date (auto from job type)"
              type="date"
              className="min-w-0"
              inputClassName="h-10 min-w-0"
              disabled
            />
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
            />
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
          <TextareaField<TaskFormValues>
            name="description"
            label="Description"
            rows={3}
            maxLength={DESCRIPTION_MAX_LENGTH}
          />
        </div>

        {/* Job items — auto-filled from JobType template; SM can edit */}
        <div className={embedded ? "min-w-0 space-y-3 border-t border-border pt-6" : "min-w-0 space-y-3"}>
          <div className="min-w-0 space-y-3">
            {itemsLocked ? (
              <p className="text-xs font-medium text-warning-foreground">
                Locked — tick at least one item on the previous working day before adding new
                items.
              </p>
            ) : null}
            {renderAddControls(activeOperativeId, {
              addButtonLabel: "Add item",
              querySuffix: "top",
              includeOperative: true,
            })}
          </div>

          {operativeCards.length === 0 ? (
            <div className="card-elevated p-6 text-sm text-muted-foreground">
              No job items yet. Select a job type with a template, or choose an operative and add a
              package / add-on.
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
            const { packages, addOns } = packageGroupsForOperative(indexes);
            const operativeTotal = indexes.reduce((sum, index) => {
              const qty = Number(items[index]?.quantity || 0);
              const rate = Number(items[index]?.rate || 0);
              const line = qty * rate;
              return sum + (Number.isFinite(line) ? line : 0);
            }, 0);

            return (
              <div
                key={operativeId}
                className="card-elevated min-w-0 space-y-3 overflow-hidden p-4 sm:p-6"
              >
                <div className="min-w-0 space-y-3">
                  <h4 className="font-medium">{name}</h4>
                  {isUnassigned ? (
                    <p className="text-xs text-muted-foreground">
                      Assign an operative on each package or add-on.
                    </p>
                  ) : (
                    renderAddControls(operativeId)
                  )}
                </div>

                {indexes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No lines yet. Select Package or Add-on, then click Add for this operative.
                  </p>
                ) : null}

                {packages.map(([packageId, pkg]) => (
                  <div key={`${operativeId}-pkg-${packageId}`} className="min-w-0 space-y-2">
                    <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                      <div className="flex min-w-0 items-center">
                        <span className="inline-flex max-w-full items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium leading-none text-secondary-foreground">
                          <AppTooltip content={`Package: ${pkg.name}`} asChild align="start">
                            <span className="truncate">Package: {pkg.name}</span>
                          </AppTooltip>
                        </span>
                      </div>
                      {isUnassigned
                        ? renderAssignOperativeControls(`pkg-${packageId}`, pkg.indexes)
                        : null}
                    </div>
                    <ProductLinesTable
                      indexes={pkg.indexes}
                      fields={fields}
                      items={items}
                      productLabels={productLabels}
                      onRemove={remove}
                      onRateCommit={(index, previousRate, nextRate) => {
                        if (previousRate === nextRate) return;
                        setValue(`items.${index}.rate`, nextRate);
                        setRatePrompt({ index, previousRate, nextRate });
                      }}
                      getValues={getValues}
                    />
                  </div>
                ))}

                {addOns.length > 0 ? (
                  isUnassigned ? (
                    addOns.map((index) => {
                      const productId = items[index]?.productId ?? "";
                      const productName =
                        (productId && productLabels[productId]) ||
                        (productId ? `Product #${productId}` : "Add-on");
                      return (
                        <div key={`${operativeId}-addon-${index}`} className="min-w-0 space-y-2">
                          <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                            <div className="flex min-w-0 items-center">
                              <span className="inline-flex max-w-full items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
                                <AppTooltip content={`Add-on: ${productName}`} asChild align="start">
                                  <span className="truncate">Add-on: {productName}</span>
                                </AppTooltip>
                              </span>
                            </div>
                            {renderAssignOperativeControls(`addon-${index}`, [index])}
                          </div>
                          <ProductLinesTable
                            indexes={[index]}
                            fields={fields}
                            items={items}
                            productLabels={productLabels}
                            onRemove={remove}
                            onRateCommit={(lineIndex, previousRate, nextRate) => {
                              if (previousRate === nextRate) return;
                              setValue(`items.${lineIndex}.rate`, nextRate);
                              setRatePrompt({ index: lineIndex, previousRate, nextRate });
                            }}
                            getValues={getValues}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 items-center">
                        <span className="inline-flex max-w-full items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
                          Add-ons
                        </span>
                      </div>
                      <ProductLinesTable
                        indexes={addOns}
                        fields={fields}
                        items={items}
                        productLabels={productLabels}
                        onRemove={remove}
                        onRateCommit={(index, previousRate, nextRate) => {
                          if (previousRate === nextRate) return;
                          setValue(`items.${index}.rate`, nextRate);
                          setRatePrompt({ index, previousRate, nextRate });
                        }}
                        getValues={getValues}
                      />
                    </div>
                  )
                ) : null}

                {indexes.length > 0 ? (
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/50 px-3 py-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                        <Calculator className="h-3.5 w-3.5" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">Total</div>
                        <div className="text-xs text-muted-foreground">
                          {indexes.length} item{indexes.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                    <AppTooltip content={fmtGBP(operativeTotal)} asChild align="end">
                      <div className="shrink-0 font-display text-base font-semibold tabular-nums tracking-tight text-foreground sm:text-lg">
                        {fmtGBP(operativeTotal)}
                      </div>
                    </AppTooltip>
                  </div>
                ) : null}
              </div>
            );
          })}
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
      </fieldset>

      <HoldDetailsModal
        open={holdOpen}
        onClose={handleHoldCancel}
        onConfirm={handleHoldConfirm}
      />
    </>
  );
}

const PRODUCT_LINE_TABLE_MIN_WIDTH = "1264px";

function ProductLinesTable({
  indexes,
  fields,
  items,
  productLabels,
  onRemove,
  onRateCommit,
  getValues,
}: {
  indexes: number[];
  fields: { id: string }[];
  items: TaskFormValues["items"];
  productLabels: Record<string, string>;
  onRemove: (index: number) => void;
  onRateCommit: (index: number, previousRate: string, nextRate: string) => void;
  getValues: ReturnType<typeof useFormContext<TaskFormValues>>["getValues"];
}) {
  const { register, setValue, control } = useFormContext<TaskFormValues>();
  const timeSlotsQuery = useQuery({
    queryKey: ["lookups", "time-slots"],
    queryFn: async () => (await tasksService.timeSlots()).data ?? [],
  });

  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-md border border-border/60">
      <table
        className="w-full table-fixed text-sm"
        style={{ minWidth: PRODUCT_LINE_TABLE_MIN_WIDTH }}
      >
        <colgroup>
          <col style={{ width: "168px" }} />
          <col style={{ width: "158px" }} />
          <col style={{ width: "118px" }} />
          <col style={{ width: "98px" }} />
          <col style={{ width: "98px" }} />
          <col style={{ width: "98px" }} />
          <col style={{ width: "118px" }} />
          <col style={{ width: "88px" }} />
          <col style={{ width: "64px" }} />
          <col style={{ width: "208px" }} />
          <col style={{ width: "48px" }} />
        </colgroup>
        <thead>
          <tr className="border-b bg-muted/20 text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Work date</th>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Qty</th>
            <th className="px-3 py-2 font-medium">Done</th>
            <th className="px-3 py-2 font-medium">Remaining</th>
            <th className="px-3 py-2 font-medium">Rate</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Ticked</th>
            <th className="px-3 py-2 font-medium">Notes</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {indexes.map((index) => (
            <ProductLineRow
              key={fields[index]?.id ?? index}
              index={index}
              item={items[index]}
              productLabel={
                items[index]?.productId
                  ? productLabels[items[index].productId] || `Product #${items[index].productId}`
                  : "—"
              }
              timeSlots={timeSlotsQuery.data ?? []}
              register={register}
              setValue={setValue}
              control={control}
              getValues={getValues}
              onRemove={() => onRemove(index)}
              onRateCommit={onRateCommit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductLineRow({
  index,
  item,
  productLabel,
  timeSlots,
  register,
  setValue,
  control,
  getValues,
  onRemove,
  onRateCommit,
}: {
  index: number;
  item: TaskFormValues["items"][number];
  productLabel: string;
  timeSlots: { id: number; name: string }[];
  register: ReturnType<typeof useFormContext<TaskFormValues>>["register"];
  setValue: ReturnType<typeof useFormContext<TaskFormValues>>["setValue"];
  control: ReturnType<typeof useFormContext<TaskFormValues>>["control"];
  getValues: ReturnType<typeof useFormContext<TaskFormValues>>["getValues"];
  onRemove: () => void;
  onRateCommit: (index: number, previousRate: string, nextRate: string) => void;
}) {
  const quantity = Number(useWatch({ control, name: `items.${index}.quantity` }) || 0);
  const doneQty = Number(useWatch({ control, name: `items.${index}.doneQty` }) || 0);
  const rate = Number(useWatch({ control, name: `items.${index}.rate` }) || 0);
  const notes = String(useWatch({ control, name: `items.${index}.notes` }) ?? "");
  const remainingQty =
    Number.isFinite(quantity) && Number.isFinite(doneQty) ? Math.max(0, quantity - doneQty) : 0;
  const amount = Number.isFinite(quantity * rate) ? quantity * rate : 0;
  const rateBeforeEdit = useRef(item?.rate ?? "0");

  useEffect(() => {
    rateBeforeEdit.current = getValues(`items.${index}.rate`) || "0";
  }, [getValues, index, item?.id, item?.productId]);

  useEffect(() => {
    const current = getValues(`items.${index}.timeSlotId`);
    if (!current && timeSlots.length > 0) {
      setValue(`items.${index}.timeSlotId`, String(timeSlots[0].id), { shouldDirty: false });
    }
  }, [getValues, index, setValue, timeSlots]);

  return (
    <tr className="align-middle border-b border-border/50">
      <td className="min-w-0 px-3 py-2 font-medium">
        <TruncatedTooltip text={productLabel} maxChars={28} />
      </td>
      <td className="px-3 py-2">
        <input
          type="date"
          className="h-9 w-[150px] max-w-full rounded-md border border-input bg-background px-3 text-sm"
          {...register(`items.${index}.workDate`)}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="h-9 w-[110px] max-w-full rounded-md border border-input bg-background px-2 text-sm"
          {...register(`items.${index}.timeSlotId`)}
        >
          <option value="">Select…</option>
          {timeSlots.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0.01}
          step={0.01}
          className="h-9 w-[90px] max-w-full rounded-md border border-input bg-background px-3 text-sm"
          {...register(`items.${index}.quantity`)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={0.01}
          className="h-9 w-[90px] max-w-full rounded-md border border-input bg-background px-3 text-sm"
          {...register(`items.${index}.doneQty`)}
        />
      </td>
      <td className="px-3 py-2">
        <span className="inline-block tabular-nums text-muted-foreground">
          {Number.isInteger(remainingQty) ? remainingQty : remainingQty.toFixed(2)}
        </span>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={0.01}
          className="h-9 w-[110px] max-w-full rounded-md border border-input bg-background px-3 text-sm"
          {...register(`items.${index}.rate`)}
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
      <td className="px-3 py-2 font-medium">
        <AppTooltip content={fmtGBP(amount)} asChild align="end">
          <span className="inline-block tabular-nums">{fmtGBP(amount)}</span>
        </AppTooltip>
      </td>
      <td className="px-3 py-2">
        <AppTooltip content="Tick to confirm this line for the daily programmer" asChild>
          <span className="inline-flex">
            <Controller
              control={control}
              name={`items.${index}.isTicked`}
              render={({ field }) => (
                <Checkbox
                  checked={!!field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-label="Ticked"
                />
              )}
            />
          </span>
        </AppTooltip>
      </td>
      <td className="min-w-0 px-3 py-2">
        <AppTooltip
          content={notes.trim() || undefined}
          disabled={!notes.trim()}
          asChild
          align="start"
        >
          <div className="min-w-0">
            <input
              type="text"
              className="h-9 w-[200px] max-w-full truncate rounded-md border border-input bg-background px-3 text-sm"
              placeholder="Notes"
              {...register(`items.${index}.notes`)}
            />
          </div>
        </AppTooltip>
      </td>
      <td className="px-3 py-2">
        <AppTooltip content="Remove item" asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onRemove}
            aria-label="Remove item"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AppTooltip>
      </td>
    </tr>
  );
}

function TruncatedTooltip({ text, maxChars = 24 }: { text: string; maxChars?: number }) {
  const value = text.trim();
  if (!value) return <span>—</span>;
  const truncated = truncateWithEllipsis(value, maxChars);
  const label = <span className="block min-w-0 max-w-[12rem] truncate">{truncated}</span>;
  return (
    <AppTooltip content={value} asChild align="start">
      <span className="block min-w-0 max-w-[12rem] cursor-default">{label}</span>
    </AppTooltip>
  );
}
