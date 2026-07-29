import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useFormContext, type Path } from "react-hook-form";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextField } from "@/components/form";
import { useDebouncedSearch } from "@/components/data-table";
import { AppTooltip } from "@/components/AppTooltip";
import { productsService, type ApiProduct } from "@/lib/api/services/products";
import {
  emptyTradeGroupItem,
  type TradeGroupFormValues,
  type TradeGroupItemFormValues,
} from "@/lib/trade-group-form";
import { DESCRIPTION_MAX_LENGTH } from "@/lib/field-validation";
import { fmtGBPp } from "@/lib/data";
import { truncateWithEllipsis } from "@/lib/module-ui";
import { cn } from "@/lib/utils";

const NOTES_MAX_LENGTH = DESCRIPTION_MAX_LENGTH;
const SELECTED_PANEL_ID = "selected-panel";
const AVAILABLE_PAGE_SIZE = 50;
const PRODUCT_LABEL_MAX = 30;
const SELECTED_ITEMS_ROW_GRID =
  "grid grid-cols-[2rem_minmax(0,1fr)_4.5rem_5.5rem_6.5rem_minmax(0,1fr)_2rem] items-center gap-x-2 overflow-hidden";

function SelectedItemsRowHeader() {
  return (
    <div
      className={cn(
        SELECTED_ITEMS_ROW_GRID,
        "hidden px-2 pb-1 text-xs font-medium text-muted-foreground sm:grid sm:px-3",
      )}
      aria-hidden
    >
      <span />
      <span className="min-w-0 truncate">Product</span>
      <span className="min-w-0">Qty</span>
      <span className="min-w-0">Price</span>
      <span className="min-w-0">Total</span>
      <span className="min-w-0 truncate">Notes</span>
      <span />
    </div>
  );
}

type AvailableDragData = {
  type: "available";
  productId: string;
  productName: string;
  sku: string;
  salePrice: number;
};

type SelectedDragData = {
  type: "selected";
  fieldId: string;
  index: number;
};

function availableId(productId: string | number) {
  return `available-${productId}`;
}

function selectedId(fieldId: string) {
  return `selected-${fieldId}`;
}

function parseSelectedId(id: string) {
  return id.startsWith("selected-") ? id.slice("selected-".length) : null;
}

function productToItem(product: {
  productId: string;
  productName: string;
  salePrice: number;
}): TradeGroupItemFormValues {
  return {
    ...emptyTradeGroupItem(),
    productId: product.productId,
    productName: product.productName,
    quantity: "1",
    salePrice: String(product.salePrice),
    notes: "",
  };
}

function TruncatedLabel({
  value,
  className,
  empty = "—",
}: {
  value: string;
  className?: string;
  empty?: string;
}) {
  const text = value.trim();
  if (!text) {
    return <span className={className}>{empty}</span>;
  }

  const truncated = truncateWithEllipsis(text, PRODUCT_LABEL_MAX);
  const needsTooltip = text.length > PRODUCT_LABEL_MAX;

  const label = (
    <span className={cn("block max-w-full truncate", className)}>{truncated}</span>
  );

  if (!needsTooltip) return label;

  return (
    <AppTooltip content={text} asChild align="start">
      <span className="block max-w-full cursor-default">{label}</span>
    </AppTooltip>
  );
}

/**
 * Dual-panel Trade Group items editor:
 * Available Products (search + multi-select + drag) → Selected Items (qty/notes/reorder).
 */
export function TradeGroupItemsEditor({ disabled = false }: { disabled?: boolean }) {
  const { control, watch, getValues } = useFormContext<TradeGroupFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "items",
  });

  const selectedItems = watch("items") ?? [];
  const selectedProductIds = useMemo(
    () => new Set(selectedItems.map((item) => item.productId).filter(Boolean)),
    [selectedItems],
  );

  const { searchInput, setSearchInput, search } = useDebouncedSearch();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [activeDrag, setActiveDrag] = useState<
    | { kind: "available"; productId: string; productName: string; sku: string; salePrice: number }
    | { kind: "selected"; productName: string; quantity: string }
    | null
  >(null);

  const productsQuery = useQuery({
    queryKey: ["products", "trade-group-picker", search],
    queryFn: async () => {
      const res = await productsService.list({
        page: 1,
        pageSize: AVAILABLE_PAGE_SIZE,
        search,
        sortBy: "name",
        sortDir: "asc",
      });
      return res.data;
    },
    staleTime: 30_000,
  });

  const availableProducts = useMemo(() => {
    const items = productsQuery.data?.items ?? [];
    return items.filter(
      (product) =>
        product.isActive !== false && !selectedProductIds.has(String(product.id)),
    );
  }, [productsQuery.data?.items, selectedProductIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const addProducts = useCallback(
    (products: Array<{ productId: string; productName: string; salePrice: number }>) => {
      if (disabled || products.length === 0) return;
      const currentIds = new Set(
        (getValues("items") ?? []).map((item) => item.productId).filter(Boolean),
      );
      const toAdd = products.filter((product) => !currentIds.has(product.productId));
      if (toAdd.length === 0) return;
      append(toAdd.map(productToItem));
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const product of toAdd) next.delete(product.productId);
        return next;
      });
    },
    [append, disabled, getValues],
  );

  const toggleChecked = useCallback((productId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  const addChecked = useCallback(() => {
    const products = availableProducts
      .filter((product) => checkedIds.has(String(product.id)))
      .map((product) => ({
        productId: String(product.id),
        productName: product.name?.trim() || product.sku || `Product ${product.id}`,
        salePrice: product.salePrice ?? 0,
      }));
    addProducts(products);
  }, [addProducts, availableProducts, checkedIds]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as AvailableDragData | SelectedDragData | undefined;
      if (!data) return;
      if (data.type === "available") {
        setActiveDrag({
          kind: "available",
          productId: data.productId,
          productName: data.productName,
          sku: data.sku,
          salePrice: data.salePrice,
        });
        return;
      }
      const item = getValues(`items.${data.index}` as Path<TradeGroupFormValues>) as
        | TradeGroupItemFormValues
        | undefined;
      setActiveDrag({
        kind: "selected",
        productName: item?.productName || `Item ${data.index + 1}`,
        quantity: item?.quantity || "1",
      });
    },
    [getValues],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      if (disabled) return;

      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as AvailableDragData | SelectedDragData | undefined;
      const overId = String(over.id);

      if (activeData?.type === "available") {
        const overSelectedFieldId = parseSelectedId(overId);
        const overSelectedPanel = overId === SELECTED_PANEL_ID || overSelectedFieldId != null;
        if (!overSelectedPanel) return;

        const draggedId = activeData.productId;
        const draggedProduct = availableProducts.find((p) => String(p.id) === draggedId);
        const shouldAddChecked = checkedIds.has(draggedId) && checkedIds.size > 1;
        if (shouldAddChecked) {
          const products = availableProducts
            .filter((product) => checkedIds.has(String(product.id)))
            .map((product) => ({
              productId: String(product.id),
              productName: product.name?.trim() || product.sku || `Product ${product.id}`,
              salePrice: product.salePrice ?? 0,
            }));
          addProducts(products);
          return;
        }

        addProducts([
          {
            productId: activeData.productId,
            productName: activeData.productName,
            salePrice: draggedProduct?.salePrice ?? activeData.salePrice ?? 0,
          },
        ]);
        return;
      }

      if (activeData?.type === "selected") {
        const overSelectedFieldId = parseSelectedId(overId);
        if (!overSelectedFieldId || overSelectedFieldId === activeData.fieldId) return;

        const oldIndex = fields.findIndex((field) => field.id === activeData.fieldId);
        const newIndex = fields.findIndex((field) => field.id === overSelectedFieldId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
        move(oldIndex, newIndex);
      }
    },
    [addProducts, availableProducts, checkedIds, disabled, fields, move],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const selectedFieldIds = fields.map((field) => selectedId(field.id));
  const checkedCount = [...checkedIds].filter((id) => !selectedProductIds.has(id)).length;

  return (
    <div className="card-elevated space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h3 className="font-display font-semibold">Items</h3>
        <p className="text-xs text-muted-foreground">
          Drag products to the right, or select multiple and add them together.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-4">
            <AvailableProductsPanel
              disabled={disabled}
              searchInput={searchInput}
              onSearchChange={setSearchInput}
              loading={productsQuery.isLoading}
              error={productsQuery.isError}
              products={availableProducts}
              checkedIds={checkedIds}
              onToggleChecked={toggleChecked}
              checkedCount={checkedCount}
              onAddChecked={addChecked}
            />
          </div>

          <div className="min-w-0 lg:col-span-8">
            <SelectedItemsPanel
              disabled={disabled}
              fields={fields}
              selectedFieldIds={selectedFieldIds}
              onRemove={remove}
            />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag?.kind === "available" ? (
            <ProductRowPreview name={activeDrag.productName} sku={activeDrag.sku} dragging />
          ) : activeDrag?.kind === "selected" ? (
            <div className="max-w-xs rounded-md border bg-card px-3 py-2 shadow-lg">
              <TruncatedLabel value={activeDrag.productName} className="text-sm font-medium" />
              <div className="text-xs text-muted-foreground">Qty {activeDrag.quantity}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function PanelShell({
  title,
  subtitle,
  action,
  isOver,
  setNodeRef,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  action?: ReactNode;
  isOver?: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[22rem] min-w-0 flex-col overflow-hidden rounded-md border bg-background",
        isOver && "ring-1 ring-ring",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <h4 className="font-display text-sm font-semibold">{title}</h4>
          <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function AvailableProductsPanel({
  disabled,
  searchInput,
  onSearchChange,
  loading,
  error,
  products,
  checkedIds,
  onToggleChecked,
  checkedCount,
  onAddChecked,
}: {
  disabled: boolean;
  searchInput: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  error: boolean;
  products: ApiProduct[];
  checkedIds: Set<string>;
  onToggleChecked: (productId: string, checked: boolean) => void;
  checkedCount: number;
  onAddChecked: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "available-panel",
    disabled,
  });

  return (
    <PanelShell
      title="Available Products"
      subtitle="Search and select products to add"
      isOver={isOver}
      setNodeRef={setNodeRef}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || checkedCount === 0}
          onClick={onAddChecked}
        >
          <Plus className="h-4 w-4" />
          Add selected{checkedCount > 0 ? ` (${checkedCount})` : ""}
        </Button>
      }
    >
      <div className="border-b px-3 py-3 sm:px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search products…"
            disabled={disabled}
            className="w-full pl-9"
            aria-label="Search products"
          />
        </div>
      </div>

      <ScrollArea className="h-72 min-w-0 flex-1 sm:h-80">
        <div className="space-y-1 p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading products…
            </div>
          ) : error ? (
            <div className="px-3 py-12 text-center text-sm text-destructive">
              Unable to load products.
            </div>
          ) : products.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-muted-foreground">
              No products found.
            </div>
          ) : (
            products.map((product) => {
              const productId = String(product.id);
              const name = product.name?.trim() || product.sku || `Product ${product.id}`;
              const sku = product.sku?.trim() || "";
              return (
                <AvailableProductRow
                  key={product.id}
                  productId={productId}
                  name={name}
                  sku={sku}
                  salePrice={product.salePrice ?? 0}
                  disabled={disabled}
                  checked={checkedIds.has(productId)}
                  onCheckedChange={(checked) => onToggleChecked(productId, checked)}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </PanelShell>
  );
}

function AvailableProductRow({
  productId,
  name,
  sku,
  salePrice,
  disabled,
  checked,
  onCheckedChange,
}: {
  productId: string;
  name: string;
  sku: string;
  salePrice: number;
  disabled: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: availableId(productId),
    disabled,
    data: {
      type: "available",
      productId,
      productName: name,
      sku,
      salePrice,
    } satisfies AvailableDragData,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/30",
        isDragging && "border-border bg-muted/50",
      )}
    >
      <button
        type="button"
        className={cn(
          "inline-grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground",
          disabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-grab hover:bg-muted active:cursor-grabbing",
        )}
        aria-label={`Drag ${name}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-label={`Select ${name}`}
      />

      <div className="min-w-0 flex-1 overflow-hidden">
        <TruncatedLabel value={name} className="text-sm font-medium" />
        {sku ? (
          <TruncatedLabel value={`SKU: ${sku}`} className="text-xs text-muted-foreground" />
        ) : null}
      </div>
    </div>
  );
}

function SelectedItemsPanel({
  disabled,
  fields,
  selectedFieldIds,
  onRemove,
}: {
  disabled: boolean;
  fields: Array<{ id: string }>;
  selectedFieldIds: string[];
  onRemove: (index: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: SELECTED_PANEL_ID,
    disabled,
  });

  return (
    <PanelShell
      title="Selected Items"
      subtitle={
        fields.length === 0
          ? "Drop products here or use Add selected"
          : `${fields.length} product${fields.length === 1 ? "" : "s"} · drag to reorder`
      }
      isOver={isOver}
      setNodeRef={setNodeRef}
    >
      <ScrollArea className="h-72 min-w-0 flex-1 sm:h-80">
        <SortableContext items={selectedFieldIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 p-3 pt-3">
            {fields.length > 0 ? <SelectedItemsRowHeader /> : null}
            {fields.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-12 text-center text-sm text-muted-foreground">
                No items selected yet.
              </div>
            ) : (
              fields.map((field, index) => (
                <SelectedItemRow
                  key={field.id}
                  fieldId={field.id}
                  index={index}
                  disabled={disabled}
                  onRemove={() => onRemove(index)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </PanelShell>
  );
}

function SelectedItemRow({
  fieldId,
  index,
  disabled,
  onRemove,
}: {
  fieldId: string;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  const { watch } = useFormContext<TradeGroupFormValues>();
  const productName = watch(`items.${index}.productName`);
  const quantity = watch(`items.${index}.quantity`);
  const salePrice = watch(`items.${index}.salePrice`);
  const lineTotal = (() => {
    const qty = Number(quantity);
    const price = Number(salePrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
    return qty * price;
  })();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: selectedId(fieldId),
    disabled,
    data: {
      type: "selected",
      fieldId,
      index,
    } satisfies SelectedDragData,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const displayName = productName?.trim() || `Product #${index + 1}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "min-w-0 rounded-md border bg-card py-2 shadow-sm sm:py-3",
        isDragging && "border-accent/40 shadow-md",
      )}
    >
      <div className={cn(SELECTED_ITEMS_ROW_GRID, "min-w-0 px-2 sm:px-3")}>
        <button
          type="button"
          className={cn(
            "inline-grid h-8 w-8 place-items-center rounded-md text-muted-foreground",
            disabled
              ? "cursor-not-allowed opacity-40"
              : "cursor-grab hover:bg-muted active:cursor-grabbing",
          )}
          aria-label={`Reorder ${displayName}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 overflow-hidden">
          <TruncatedLabel value={displayName} className="text-sm font-medium" />
        </div>

        <div className="min-w-0 overflow-hidden">
          <TextField<TradeGroupFormValues>
            name={`items.${index}.quantity` as Path<TradeGroupFormValues>}
            required
            type="number"
            min={0.01}
            step="any"
            disabled={disabled}
            aria-label="Quantity"
            className="min-w-0 w-full space-y-0"
            inputClassName="min-w-0 truncate text-center"
          />
        </div>

        <div className="min-w-0 overflow-hidden">
          <TextField<TradeGroupFormValues>
            name={`items.${index}.salePrice` as Path<TradeGroupFormValues>}
            required
            type="number"
            min={0}
            step="0.01"
            disabled={disabled}
            aria-label="Price"
            className="min-w-0 w-full space-y-0"
            inputClassName="min-w-0 truncate text-right"
          />
        </div>

        <AppTooltip content={fmtGBPp(lineTotal)} asChild align="end">
          <div
            className="flex h-9 min-w-0 items-center justify-end overflow-hidden rounded-md border border-input bg-muted/40 px-2 text-sm font-mono tabular-nums text-muted-foreground"
            aria-label="Line total"
          >
            <span className="truncate">{fmtGBPp(lineTotal)}</span>
          </div>
        </AppTooltip>

        <div className="min-w-0 overflow-hidden">
          <TextField<TradeGroupFormValues>
            name={`items.${index}.notes` as Path<TradeGroupFormValues>}
            maxLength={NOTES_MAX_LENGTH}
            disabled={disabled}
            aria-label="Notes"
            placeholder="Notes"
            className="min-w-0 w-full space-y-0"
            inputClassName="min-w-0 truncate"
          />
        </div>

        <AppTooltip content="Remove item" asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={disabled}
            aria-label={`Remove ${displayName}`}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AppTooltip>
      </div>
    </div>
  );
}

function ProductRowPreview({
  name,
  sku,
  dragging = false,
}: {
  name: string;
  sku?: string;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex max-w-xs items-center gap-2 rounded-md border bg-card px-3 py-2",
        dragging && "shadow-lg",
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 overflow-hidden">
        <TruncatedLabel value={name} className="text-sm font-medium" />
        {sku ? (
          <TruncatedLabel value={`SKU: ${sku}`} className="text-xs text-muted-foreground" />
        ) : null}
      </div>
    </div>
  );
}
