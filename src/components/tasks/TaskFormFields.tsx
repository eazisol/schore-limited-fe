import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  TextField,
  TextareaField,
  SearchableSelectField,
} from "@/components/form";
import { SearchableSelect } from "@/components/form/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import { Plus, Trash2 } from "lucide-react";
import { emptyTaskItem, type TaskFormValues, type TaskItemFormValues } from "@/lib/task-form";
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
import { tasksService } from "@/lib/api/services/tasks";

const ADD_AS_OPTIONS: SearchableSelectOption[] = [
  { value: "tradeGroup", label: "Package" },
  { value: "product", label: "Add-on" },
];

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
  itemsLocked = false,
  selectedLabels,
  itemSelectedLabels = {},
}: {
  disabled?: boolean;
  /** When true, add-item controls are disabled (daily per-task lock). */
  itemsLocked?: boolean;
  selectedLabels?: TaskFormSelectedLabels;
  /** Keyed by existing TaskItem id (string). */
  itemSelectedLabels?: Record<string, TaskItemSelectedLabels>;
}) {
  const { control, setValue, getValues } = useFormContext<TaskFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const addControlsDisabled = disabled || itemsLocked;
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
  const previousStatusIdRef = useRef(getValues("statusId") || "");
  const statusBeforeHoldRef = useRef(getValues("statusId") || "");

  const items = useWatch({ control, name: "items" }) ?? [];
  const startDate = useWatch({ control, name: "startDate" });

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
      const key = item.operativeId || `__unassigned_${index}`;
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
      toast.warning("This task is locked. Tick previous-day work before adding items.");
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
          rate: String(groupItem.salePrice ?? 0),
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
      rate: String(product.salePrice ?? 0),
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
      toast.warning("This task is locked. Tick previous-day work before adding items.");
      return;
    }
    if (!activeOperativeId) {
      toast.warning("Select an operative first.");
      return;
    }
    ensureOperativeMetaOnly();
    await addForOperative(activeOperativeId);
  }

  function renderAddControls(
    operativeId: string,
    options?: { addButtonLabel?: string; querySuffix?: string },
  ) {
    const addState = getAddState(operativeId);
    const addButtonLabel = options?.addButtonLabel ?? "Add for this operative";
    const querySuffix = options?.querySuffix ?? operativeId;
    const canAdd =
      Boolean(operativeId) &&
      (addState.itemKind === "tradeGroup" ? Boolean(addState.tradeGroupId) : Boolean(addState.productId));

    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px]">
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
        <div className="min-w-[220px]">
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
        <Button
          type="button"
          size="sm"
          variant={options?.addButtonLabel ? "default" : "outline"}
          onClick={() => void (options?.addButtonLabel ? addFromTop() : addForOperative(operativeId))}
          disabled={!canAdd || addControlsDisabled}
        >
          <Plus className="mr-1 h-4 w-4" />
          {addButtonLabel}
        </Button>
      </div>
    );
  }

  const operativeCards = useMemo(() => {
    const ids: string[] = [];
    for (const [key] of grouped) {
      if (!key.startsWith("__unassigned_")) ids.push(key);
    }
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
    return { packages: Array.from(packages.entries()), addOns };
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
    <fieldset disabled={disabled} className="space-y-6">
      <div className="card-elevated space-y-4 p-4 sm:p-6">
        <h3 className="font-display font-semibold">Task details</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchableSelectField<TaskFormValues>
            name="propertyId"
            label="Property"
            required
            placeholder="Select property"
            searchPlaceholder="Search properties…"
            queryKey={["lookups", "properties"]}
            selectedLabel={selectedLabels?.property}
            fetchOptions={fetchPropertyOptions}
          />
          <SearchableSelectField<TaskFormValues>
            name="jobTypeId"
            label="Job type"
            required
            placeholder="Select job type"
            searchPlaceholder="Search job types…"
            queryKey={["lookups", "job-types"]}
            selectedLabel={selectedLabels?.jobType}
            fetchOptions={fetchJobTypeOptions}
          />
          <TextField<TaskFormValues> name="startDate" label="Start date" type="date" required />
          <TextField<TaskFormValues> name="handOverDate" label="Hand over date" type="date" />
          <TextField<TaskFormValues>
            name="budget"
            label="Budget"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
          />
          <SearchableSelectField<TaskFormValues>
            name="statusId"
            label="Status"
            required
            placeholder="Select status"
            searchPlaceholder="Search statuses…"
            queryKey={["lookups", "statuses", "TASK"]}
            selectedLabel={selectedLabels?.status}
            fetchOptions={fetchTaskStatusOptions}
            onSelect={handleStatusSelect}
          />
          <SearchableSelectField<TaskFormValues>
            name="siteManagerId"
            label="Site manager"
            placeholder="Select site manager"
            searchPlaceholder="Search site managers…"
            queryKey={["lookups", "site-managers"]}
            selectedLabel={selectedLabels?.siteManager}
            fetchOptions={fetchSiteManagerOptions}
            emptyOption={{ value: "", label: "None" }}
          />
        </div>
        <TextareaField<TaskFormValues> name="description" label="Description" rows={3} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold">Task items by operative</h3>
            {itemsLocked ? (
              <p className="mt-1 text-xs font-medium text-warning-foreground">
                Locked — tick at least one item on the previous working day before adding new items.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px]">
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
            {renderAddControls(activeOperativeId, {
              addButtonLabel: "Add item",
              querySuffix: "top",
            })}
          </div>
        </div>

        {operativeCards.length === 0 ? (
          <div className="card-elevated p-6 text-sm text-muted-foreground">
            No task items yet. Choose an operative, then add a package or add-on from the top bar.
          </div>
        ) : null}

        {operativeCards.map((operativeId) => {
          const groupEntry = grouped.find(([key]) => key === operativeId);
          const indexes = groupEntry?.[1].indexes ?? [];
          const name =
            operativeLabels[operativeId] ||
            (operativeId === activeOperativeId ? activeOperativeLabel : `Operative #${operativeId}`);
          const { packages, addOns } = packageGroupsForOperative(indexes);

          return (
            <div key={operativeId} className="card-elevated space-y-4 p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h4 className="font-medium">{name}</h4>
                {renderAddControls(operativeId)}
              </div>

              {indexes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No lines yet. Select Package or Add-on, then click Add for this operative.
                </p>
              ) : null}

              {packages.map(([packageId, pkg]) => (
                <div key={`${operativeId}-pkg-${packageId}`} className="space-y-2">
                  <p className="text-sm font-medium">Package: {pkg.name}</p>
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
                <div className="space-y-2">
                  <p className="text-sm font-medium">Add-ons</p>
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              New rate: £{Number(ratePrompt.nextRate || 0).toFixed(2)}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => resolveRatePrompt(false)}>
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
      defaultDate={startDate || new Date().toISOString().slice(0, 10)}
    />
    </>
  );
}

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
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b bg-muted/20 text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Work date</th>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Qty</th>
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
  const rate = Number(useWatch({ control, name: `items.${index}.rate` }) || 0);
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
    <tr className="align-top border-b border-border/50">
      <td className="px-3 py-2 font-medium">{productLabel}</td>
      <td className="px-3 py-2">
        <input
          type="date"
          className="h-9 w-[150px] rounded-md border border-input bg-background px-3 text-sm"
          {...register(`items.${index}.workDate`)}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="h-9 w-[110px] rounded-md border border-input bg-background px-2 text-sm"
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
          className="h-9 w-[90px] rounded-md border border-input bg-background px-3 text-sm"
          {...register(`items.${index}.quantity`)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={0.01}
          className="h-9 w-[110px] rounded-md border border-input bg-background px-3 text-sm"
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
      <td className="px-3 py-2 font-medium">£{amount.toFixed(2)}</td>
      <td className="px-3 py-2">
        <input type="checkbox" className="h-4 w-4" {...register(`items.${index}.isTicked`)} />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          className="h-9 w-[200px] rounded-md border border-input bg-background px-3 text-sm"
          placeholder="Notes"
          {...register(`items.${index}.notes`)}
        />
      </td>
      <td className="px-3 py-2">
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label="Remove item">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}
