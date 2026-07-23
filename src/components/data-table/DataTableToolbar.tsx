import type { ReactNode } from "react";
import { Loader2, Search } from "lucide-react";
import type { DataTableSearchConfig } from "./types";

export function DataTableToolbar({
  search,
  filters,
  fetching,
  actions,
}: {
  search?: DataTableSearchConfig;
  filters?: ReactNode;
  fetching?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5 sm:px-4">
      {search && (
        <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 sm:w-80">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder ?? "Search…"}
            className="w-full min-w-0 bg-transparent text-sm outline-none"
            aria-label={search["aria-label"] ?? "Search"}
          />
        </div>
      )}
      {filters}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {fetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {actions}
      </div>
    </div>
  );
}
