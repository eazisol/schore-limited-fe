import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import { AppTooltip } from "@/components/AppTooltip";
import { cn } from "@/lib/utils";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTableRowActions } from "./DataTableRowActions";
import {
  DEFAULT_COLUMN_WIDTHS,
  NOWRAP_COLUMN_IDS,
  type DataTableAlign,
  type DataTableColumn,
  type DataTableProps,
} from "./types";

const ALIGN_CLASS: Record<DataTableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const ACTIONS_COLUMN_WIDTH = "8rem";

function resolveColumnWidth<T>(column: DataTableColumn<T>): string | undefined {
  return column.width ?? DEFAULT_COLUMN_WIDTHS[column.id];
}

function widthToRem(width: string | undefined, fallback = 8): number {
  if (!width) return fallback;
  const value = parseFloat(width);
  if (!Number.isFinite(value)) return fallback;
  if (width.endsWith("rem")) return value;
  if (width.endsWith("px")) return value / 16;
  if (width.endsWith("%")) return Math.max(6, (value / 100) * 48);
  return fallback;
}

function estimateTableMinWidthRem<T>(
  columns: DataTableColumn<T>[],
  hasActions: boolean,
): number {
  let total = hasActions ? widthToRem(ACTIONS_COLUMN_WIDTH) : 0;
  for (const column of columns) {
    total += widthToRem(resolveColumnWidth(column));
  }
  return Math.max(total, 40);
}

function plainTextLabel(content: unknown): string | undefined {
  if (typeof content === "string" || typeof content === "number") {
    const text = String(content).trim();
    return text || undefined;
  }
  return undefined;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  fetching = false,
  error = null,
  search,
  toolbarActions,
  filters,
  pagination,
  rowActions,
  sort,
  emptyState,
  loadingText = "Loading…",
  className,
  density = "compact",
  embedded = false,
}: DataTableProps<T>) {
  const cellPadding = density === "compact" ? "py-1.5" : "py-3";
  const headerPadding = density === "compact" ? "py-2" : "py-2.5";
  const actions =
    typeof rowActions === "function"
      ? rowActions
      : rowActions
        ? () => rowActions
        : null;
  const tableMinWidthRem = estimateTableMinWidthRem(columns, Boolean(actions));
  const statePadding = embedded ? "p-8" : "p-12";

  function handleSort(column: DataTableColumn<T>) {
    if (!column.sortable || !sort?.onSortChange) return;
    const nextDir =
      sort.sortBy === column.id && sort.sortDir === "asc" ? "desc" : "asc";
    sort.onSortChange(column.id, nextDir);
  }

  return (
    <div className={cn(!embedded && "card-elevated", className)}>
      {(search || filters || toolbarActions) && (
        <DataTableToolbar
          search={search}
          filters={filters}
          fetching={fetching}
          actions={toolbarActions}
        />
      )}

      {loading ? (
        <div className={cn("grid place-items-center text-sm text-muted-foreground", statePadding)}>
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          {loadingText}
        </div>
      ) : error ? (
        <div className={cn("text-center", statePadding)}>
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
          <div className="text-sm font-medium">{error.title}</div>
          {error.message && (
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
          )}
          {error.onRetry && (
            <Button variant="outline" size="sm" className="mt-4" onClick={error.onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className={cn("text-center", statePadding)}>
          <div className="text-sm font-medium">
            {emptyState?.title ?? "No data found"}
          </div>
          {emptyState?.description && (
            <p className="mt-1 text-xs text-muted-foreground">{emptyState.description}</p>
          )}
          {emptyState?.action && <div className="mt-4">{emptyState.action}</div>}
        </div>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table
            className="w-full table-fixed text-sm"
            style={{ minWidth: `${tableMinWidthRem}rem` }}
          >
            <colgroup>
              {columns.map((column) => {
                const width = resolveColumnWidth(column);
                return <col key={column.id} style={width ? { width } : undefined} />;
              })}
              {actions ? <col style={{ width: ACTIONS_COLUMN_WIDTH }} /> : null}
            </colgroup>
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {columns.map((column) => {
                  const align = column.align ?? "left";
                  const isSorted = sort?.sortBy === column.id;
                  return (
                    <th
                      key={column.id}
                      className={cn(
                        "whitespace-nowrap font-medium",
                        headerPadding,
                        column.id === columns[0]?.id ? "px-5" : "px-3",
                        ALIGN_CLASS[align],
                        column.headerClassName,
                      )}
                    >
                      {column.sortable && sort?.onSortChange ? (
                        <button
                          type="button"
                          onClick={() => handleSort(column)}
                          className="inline-flex max-w-full cursor-pointer items-center gap-1 hover:text-foreground"
                        >
                          <span className="truncate">{column.header}</span>
                          {isSorted ? (
                            sort.sortDir === "asc" ? (
                              <ArrowUp className="h-3 w-3 shrink-0" />
                            ) : (
                              <ArrowDown className="h-3 w-3 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <span className="block truncate">{column.header}</span>
                      )}
                    </th>
                  );
                })}
                {actions && (
                  <th
                    className={cn(
                      "whitespace-nowrap px-5 text-right font-medium",
                      headerPadding,
                    )}
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const rowActionsForRow = actions?.(row) ?? [];
                return (
                  <tr key={getRowId(row)} className="hover:bg-muted/30">
                    {columns.map((column) => {
                      const align = column.align ?? "left";
                      const isNowrapColumn = NOWRAP_COLUMN_IDS.has(column.id);
                      const shouldClamp = column.truncate !== false && !isNowrapColumn;
                      const content =
                        column.cell?.(row) ??
                        (column.accessor ? String(column.accessor(row) ?? "—") : "—");
                      const tooltipText = shouldClamp
                        ? plainTextLabel(
                            column.accessor?.(row) ??
                              (typeof content === "string" || typeof content === "number"
                                ? content
                                : undefined),
                          )
                        : undefined;
                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "align-middle",
                            isNowrapColumn ? "overflow-visible" : "max-w-0 overflow-hidden",
                            cellPadding,
                            column.id === columns[0]?.id ? "px-5" : "px-3",
                            ALIGN_CLASS[align],
                            column.cellClassName,
                          )}
                        >
                          {shouldClamp ? (
                            <AppTooltip
                              content={tooltipText}
                              asChild
                              align="start"
                              disabled={!tooltipText}
                            >
                              <div className="inline-block w-fit max-w-full line-clamp-2 break-words">
                                {content}
                              </div>
                            </AppTooltip>
                          ) : (
                            <div
                              className={cn(
                                isNowrapColumn
                                  ? "w-max max-w-full whitespace-nowrap"
                                  : "min-w-0 overflow-hidden",
                              )}
                            >
                              {content}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {actions && (
                      <td className={cn("overflow-hidden px-5", cellPadding)}>
                        <DataTableRowActions row={row} actions={rowActionsForRow} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination !== false && rows.length > 0 && pagination && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
          itemLabel={pagination.itemLabel}
          disabled={pagination.disabled}
          controlsAlign={pagination.controlsAlign}
          pageSizeOptions={pagination.pageSizeOptions}
        />
      )}
    </div>
  );
}
