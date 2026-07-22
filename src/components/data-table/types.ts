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
  /**
   * Fixed column width for `table-layout: fixed` (e.g. `"8rem"`, `"20%"`, `"120px"`).
   * Prefer this over putting width only in `headerClassName`.
   */
  width?: string;
  /**
   * Clamp overflowing cell content to 2 lines (with AppTooltip for full text).
   * Defaults to `true`. Set `false` for complex cells (e.g. avatar + text rows).
   */
  truncate?: boolean;
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

/** Sensible defaults so common CRUD columns stay stable without per-page width hacks. */
export const DEFAULT_COLUMN_WIDTHS: Record<string, string> = {
  name: "38%",
  code: "18%",
  sku: "14%",
  status: "12%",
  rate: "10%",
  salePrice: "12%",
  costPrice: "12%",
  orderBy: "8%",
  roles: "18%",
  role: "18%",
  usertype: "14%",
  userType: "14%",
  trade: "16%",
  cis: "10%",
  dailyRate: "12%",
  category: "16%",
  productType: "16%",
  unit: "12%",
  image: "5rem",
  groups: "10%",
  tasks: "10%",
  description: "28%",
};
