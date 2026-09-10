import type { ReactNode } from "react";

export function LookupSplitLayout({ list, form }: { list: ReactNode; form: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col lg:col-span-3">{list}</div>
      <div className="flex min-w-0 flex-col lg:col-span-6">{form}</div>
    </div>
  );
}
