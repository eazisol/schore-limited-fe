import { http } from "@/lib/api/axios";
import type { ApiEnvelope } from "./auth";

export interface ApiMenuDefinition {
  id: number;
  name: string | null;
  code: string | null;
  route: string | null;
  icon: string | null;
  parentMenuId: number | null;
  orderBy: number;
  isActive: boolean;
  children?: ApiMenuDefinition[] | null;
}

export type MenuReorderItem = {
  id: number;
  orderBy: number;
  parentMenuId: number | null;
};

export type MenuReorderPayload = {
  items: MenuReorderItem[];
};

export const menusService = {
  tree: () => http.get<ApiEnvelope<ApiMenuDefinition[]>>("Menus/tree"),
  reorder: (payload: MenuReorderPayload) =>
    http.put<ApiEnvelope<null>>("Menus/reorder", payload),
};
