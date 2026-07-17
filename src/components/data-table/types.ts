import type { ReactNode } from "react";

export type DataTableAlign = "left" | "center" | "right";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: (row: T) => string | number | null | undefined;
  cell?: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  align?: DataTableAlign;
  sortable?: boolean;
  exportable?: boolean;
}

export interface DataTableSearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}

export interface DataTablePaginationConfig {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
  disabled?: boolean;
  controlsAlign?: "start" | "center";
  pageSizeOptions?: readonly number[];
}

export interface DataTableRowAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  hidden?: (row: T) => boolean;
  onClick: (row: T) => void;
}

export interface DataTableEmptyState {
  title: string;
  description?: string;
  action?: ReactNode;
}

export interface DataTableErrorState {
  title: string;
  message?: string;
  onRetry?: () => void;
}

export interface DataTableSortConfig {
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (sortBy: string, sortDir: "asc" | "desc") => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  loading?: boolean;
  fetching?: boolean;
  error?: DataTableErrorState | null;
  search?: DataTableSearchConfig;
  filters?: ReactNode;
  toolbarActions?: ReactNode;
  pagination?: DataTablePaginationConfig | false;
  rowActions?: DataTableRowAction<T>[] | ((row: T) => DataTableRowAction<T>[]);
  sort?: DataTableSortConfig;
  emptyState?: DataTableEmptyState;
  loadingText?: string;
  className?: string;
  density?: "compact" | "comfortable";
}
