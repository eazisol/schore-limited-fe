import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { canReorderSiblings } from "@/lib/tree-order";
import { cn } from "@/lib/utils";

export type TreeReorderPayload = {
  draggedId: number;
  targetId: number;
  parentMenuId: number | null;
};

type TreeSortableContextValue = {
  disabled: boolean;
  activeId: number | null;
  overId: number | null;
};

const TreeSortableContext = createContext<TreeSortableContextValue>({
  disabled: false,
  activeId: null,
  overId: null,
});

export function TreeSortableProvider({
  children,
  disabled = false,
  onReorder,
  renderOverlay,
}: {
  children: ReactNode;
  disabled?: boolean;
  onReorder: (payload: TreeReorderPayload) => void;
  renderOverlay?: (activeId: number) => ReactNode;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: { over: { id: string | number } | null }) => {
    setOverId(event.over ? Number(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOverId(null);
      if (disabled) return;

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeData = active.data.current as
        | { parentMenuId: number | null | undefined }
        | undefined;
      const overData = over.data.current as
        | { parentMenuId: number | null | undefined }
        | undefined;
      if (!activeData || !overData) return;

      const draggedParent = activeData.parentMenuId ?? null;
      const targetParent = overData.parentMenuId ?? null;
      if (!canReorderSiblings(draggedParent, targetParent)) return;

      onReorder({
        draggedId: Number(active.id),
        targetId: Number(over.id),
        parentMenuId: draggedParent,
      });
    },
    [disabled, onReorder],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  const contextValue = useMemo(
    () => ({ disabled, activeId, overId }),
    [disabled, activeId, overId],
  );

  return (
    <TreeSortableContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        {renderOverlay && activeId != null ? (
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
            {renderOverlay(activeId)}
          </DragOverlay>
        ) : null}
      </DndContext>
    </TreeSortableContext.Provider>
  );
}

export function TreeSortableLevel({
  items,
  children,
}: {
  items: number[];
  children: ReactNode;
}) {
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

export type TreeSortableItemRenderProps = {
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  isDropTarget: boolean;
  dragHandleProps: {
    ref: (node: HTMLElement | null) => void;
    listeners: ReturnType<typeof useSortable>["listeners"];
    attributes: ReturnType<typeof useSortable>["attributes"];
  };
};

export function TreeSortableItem({
  id,
  parentMenuId,
  disabled,
  className,
  children,
}: {
  id: number;
  parentMenuId: number | null;
  disabled?: boolean;
  className?: string;
  children: (props: TreeSortableItemRenderProps) => ReactNode;
}) {
  const { activeId, overId, disabled: providerDisabled } = useContext(TreeSortableContext);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id,
    disabled: disabled || providerDisabled,
    data: { parentMenuId },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDropTarget = isOver && activeId !== id && overId === id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        className,
        isDragging && "z-20 opacity-50",
        isDropTarget && "bg-accent/10 ring-2 ring-inset ring-accent/40",
      )}
    >
      {children({
        setNodeRef,
        style,
        isDragging,
        isDropTarget,
        dragHandleProps: {
          ref: setActivatorNodeRef,
          listeners,
          attributes,
        },
      })}
    </div>
  );
}

export function TreeSortableDragHandle({
  label,
  dragHandleProps,
  disabled = false,
}: {
  label: string;
  dragHandleProps: TreeSortableItemRenderProps["dragHandleProps"];
  disabled?: boolean;
}) {
  if (disabled) {
    return <span className="inline-flex h-6 w-6 shrink-0" aria-hidden />;
  }

  return (
    <button
      type="button"
      ref={dragHandleProps.ref}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground",
        "hover:bg-muted hover:text-foreground active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
      aria-label={`Reorder ${label}`}
      {...dragHandleProps.attributes}
      {...dragHandleProps.listeners}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="currentColor"
        aria-hidden
      >
        <circle cx="5" cy="4" r="1.2" />
        <circle cx="11" cy="4" r="1.2" />
        <circle cx="5" cy="8" r="1.2" />
        <circle cx="11" cy="8" r="1.2" />
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="11" cy="12" r="1.2" />
      </svg>
    </button>
  );
}
