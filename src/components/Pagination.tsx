import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
  itemLabel?: string;
  disabled?: boolean;
  controlsAlign?: "start" | "center";
}

const DEFAULT_SIZES = [10, 25, 50, 100] as const;

export function Pagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_SIZES,
  itemLabel = "records",
  disabled,
  controlsAlign = "start",
}: PaginationProps) {
  const safeTotal = Math.max(totalPages, 1);
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const pages = buildPageList(page, safeTotal);

  const controls = (
    <>
      <PageBtn aria-label="First page" disabled={disabled || page <= 1} onClick={() => onPageChange(1)}>
        <ChevronsLeft className="h-4 w-4" />
      </PageBtn>
      <PageBtn aria-label="Previous page" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </PageBtn>
      {pages.map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
        ) : (
          <PageBtn
            key={n}
            active={n === page}
            disabled={disabled}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPageChange(n)}
          >
            {n}
          </PageBtn>
        ),
      )}
      <PageBtn aria-label="Next page" disabled={disabled || page >= safeTotal} onClick={() => onPageChange(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </PageBtn>
      <PageBtn aria-label="Last page" disabled={disabled || page >= safeTotal} onClick={() => onPageChange(safeTotal)}>
        <ChevronsRight className="h-4 w-4" />
      </PageBtn>
    </>
  );

  const summary = (
    <div className="text-xs text-muted-foreground text-center">
      Showing <span className="text-muted-foreground">{start}</span> to{" "}
      <span className="text-muted-foreground">{end}</span> of{" "}
      <span className="text-muted-foreground">{totalCount}</span> {itemLabel}
    </div>
  );

  const pageSizeSelect = (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Rows per page</span>
      <select
        value={pageSize}
        onChange={e => onPageSizeChange(Number(e.target.value))}
        disabled={disabled}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Rows per page"
      >
        {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );

  if (controlsAlign === "center") {
    return (
      <div className="p-4 border-t">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-2">
          <div className="hidden md:block" aria-hidden />
          <div className="flex items-center gap-1 flex-wrap justify-center justify-self-center">
            {controls}
          </div>
          <div className="flex justify-center md:justify-end md:self-center">
            {pageSizeSelect}
          </div>
          <div className="hidden md:block" aria-hidden />
          <div className="justify-self-center md:col-start-2">{summary}</div>
          <div className="hidden md:block" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t p-4">
      <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:items-center">
        <div className="flex flex-wrap items-center gap-1">{controls}</div>
        <div className="md:justify-self-center">{summary}</div>
        <div className="md:justify-self-end">{pageSizeSelect}</div>
      </div>
    </div>
  );
}

function PageBtn({
  children, onClick, disabled, active, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
        className={
        "min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-md border text-xs font-medium cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        (active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-input bg-background hover:bg-accent/10")
      }
    >
      {children}
    </button>
  );
}

function buildPageList(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}
