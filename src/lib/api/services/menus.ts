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

export const menusService = {
  tree: () => http.get<ApiEnvelope<ApiMenuDefinition[]>>("Menus/tree"),
};
