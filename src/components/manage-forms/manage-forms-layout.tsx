import { createContext, useContext, type ReactNode } from "react";

export type ManageFormsLayout = "columns" | "split";

const ManageFormsLayoutContext = createContext<ManageFormsLayout>("columns");

export function ManageFormsLayoutProvider({
  layout,
  children,
}: {
  layout: ManageFormsLayout;
  children: ReactNode;
}) {
  return (
    <ManageFormsLayoutContext.Provider value={layout}>{children}</ManageFormsLayoutContext.Provider>
  );
}

export function useManageFormsLayout() {
  return useContext(ManageFormsLayoutContext);
}
