import type { ReactNode } from "react";

export function LookupSplitLayout({ list, form }: { list: ReactNode; form: ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 xl:min-h-0">
      <div className="flex min-h-[20rem] min-w-0 flex-col lg:col-span-3 lg:min-h-0">{list}</div>
      <div className="flex min-h-0 min-w-0 flex-col lg:col-span-6">{form}</div>
    </div>
  );
}
