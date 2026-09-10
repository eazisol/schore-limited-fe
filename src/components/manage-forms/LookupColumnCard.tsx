import type { ReactNode } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActiveStatusBadge } from "@/components/StatusBadge";
import { CodeBadge } from "@/components/CodeBadge";
import { AppTooltip } from "@/components/AppTooltip";
import { useManageFormsLayout } from "./manage-forms-layout";

export function LookupItemList({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export function LookupColumnCard({
  title,
  searchInput,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  canAdd,
  onAdd,
  addAriaLabel,
  loading,
  fetching,
  loadingText,
  error,
  empty,
  footer,
  children,
}: {
  title: string;
  searchInput: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  canAdd: boolean;
  onAdd: () => void;
  addAriaLabel: string;
  loading: boolean;
  fetching: boolean;
  loadingText: string;
  error: { title: string; message: string; onRetry: () => void } | null;
  empty: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const layout = useManageFormsLayout();
  const isSplit = layout === "split";

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        isSplit ? "h-auto" : "min-h-[28rem] flex-1 xl:min-h-0",
      )}
    >
      {isSplit ? (
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
          <div className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full min-w-0 bg-transparent text-sm outline-none"
              aria-label={searchAriaLabel}
            />
          </div>
          {fetching && !loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
            <div className="flex items-center gap-1">
              {fetching && !loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
              {canAdd ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onAdd}
                  aria-label={addAriaLabel}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 px-3 py-2.5">
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full min-w-0 bg-transparent text-sm outline-none"
                aria-label={searchAriaLabel}
              />
            </div>
          </div>
        </>
      )}

      <div
        className={cn(
          "scrollbar-elegant overflow-y-auto",
          isSplit
            ? "max-h-[min(32rem,calc(100svh-16rem))] px-3 pb-3 pt-2"
            : "min-h-0 flex-1 px-3 pb-3",
        )}
      >
        {loading ? (
          <div className="grid h-32 place-items-center text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingText}
            </span>
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">{error.title}</p>
            <p className="mt-1 text-muted-foreground">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={error.onRetry}>
              Retry
            </Button>
          </div>
        ) : (
          children
        )}
        {!loading && !error ? empty : null}
      </div>

      {footer ? (
        <div className="shrink-0 border-t px-3 py-2">{footer}</div>
      ) : null}
    </section>
  );
}

export function LookupFormPanel({
  title,
  headerActions,
  children,
  footer,
}: {
  title: string;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex h-auto w-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="font-display text-sm font-semibold tracking-tight">{title}</h2>
        {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}
      </div>
      <div className="px-3 py-2.5">{children}</div>
      {footer ? <div className="shrink-0 border-t px-3 py-2">{footer}</div> : null}
    </section>
  );
}

export function LookupItemRow({
  label,
  code,
  subtitle,
  description,
  inactive,
  selected,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  label: string;
  /** Shown as a mono badge; never truncated with the name. */
  code?: string | null;
  subtitle?: string;
  description?: string | null;
  inactive?: boolean;
  selected?: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tooltipText = description?.trim();
  const labelContent = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate text-sm font-medium leading-tight">{label}</span>
      {code?.trim() ? <CodeBadge code={code} className="shrink-0" /> : null}
      {subtitle ? (
        <span className="min-w-0 truncate text-sm leading-tight text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
    </span>
  );

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 transition-colors",
        selected && "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
        inactive && "opacity-70",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onEdit}
      >
        {tooltipText ? (
          <AppTooltip content={tooltipText} asChild align="start">
            {labelContent}
          </AppTooltip>
        ) : (
          labelContent
        )}
      </button>
      {inactive ? (
        <ActiveStatusBadge isActive={false} className="hidden px-1.5 text-[10px] sm:inline-flex" />
      ) : null}
      <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function LookupEmptyState({
  title,
  description,
  onClear,
}: {
  title: string;
  description?: string;
  onClear?: () => void;
}) {
  return (
    <div className="grid h-32 place-items-center px-2 text-center text-sm text-muted-foreground">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description ? <p className="mt-1">{description}</p> : null}
        {onClear ? (
          <Button variant="outline" size="sm" className="mt-3" onClick={onClear}>
            Clear search
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function LookupColumnFooter({
  page,
  totalPages,
  totalCount,
  itemLabel,
  disabled,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  itemLabel: string;
  disabled: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <span>
        {totalCount} {itemLabel}
      </span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </Button>
          <span>
            {page}/{totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DeleteConfirmDialog({
  title,
  description,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  description?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-card p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {description ?? "This action cannot be undone."}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
