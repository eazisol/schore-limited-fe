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
  variant?: "icon" | "badge" | "button" | "approve" | "reject";
  className?: string;
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
  /** Optional custom width for the actions column (defaults to 12.5rem). */
  actionsColumnWidth?: string;
  /**
   * When true, skips the elevated card chrome so the table can sit inside a parent card.
   */
  embedded?: boolean;
}

/** Sensible defaults so common CRUD columns stay stable without per-page width hacks. */
export const DEFAULT_COLUMN_WIDTHS: Record<string, string> = {
  name: "16rem",
  code: "10rem",
  clientCode: "8rem",
  address: "16rem",
  sku: "10rem",
  status: "7.5rem",
  rate: "5.5rem",
  salePrice: "7.5rem",
  costPrice: "7.5rem",
  orderBy: "5rem",
  roles: "12rem",
  role: "12rem",
  usertype: "9rem",
  userType: "9rem",
  trade: "9rem",
  cis: "8rem",
  dailyRate: "7.5rem",
  category: "9rem",
  productType: "9rem",
  unit: "6rem",
  image: "5rem",
  groups: "5.5rem",
  tasks: "5.5rem",
  description: "14rem",
  createdDate: "11rem",
};

/** Columns that render pills/codes/numbers — keep text on one line. */
export const NOWRAP_COLUMN_IDS = new Set([
  "status",
  "role",
  "roles",
  "sku",
  "code",
  "clientCode",
  "salePrice",
  "costPrice",
  "dailyRate",
  "rate",
  "cis",
  "image",
  "category",
  "createdDate",
]);

/** @deprecated Prefer NOWRAP_COLUMN_IDS */
export const BADGE_COLUMN_IDS = NOWRAP_COLUMN_IDS;
