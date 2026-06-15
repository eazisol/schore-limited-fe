import { useSyncExternalStore } from "react";
import { properties as seed, type Property } from "./data";

let state: Property[] = [...seed];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const propertiesStore = {
  get: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  create: (p: Omit<Property, "id" | "daysOnSite" | "heldDays" | "spent">) => {
    const next: Property = { ...p, id: `p-${Date.now()}`, daysOnSite: 0, heldDays: 0, spent: 0 };
    state = [next, ...state];
    emit();
    return next;
  },
  update: (id: string, patch: Partial<Property>) => {
    state = state.map(p => p.id === id ? { ...p, ...patch } : p);
    emit();
  },
};

export function useProperties(): Property[] {
  return useSyncExternalStore(propertiesStore.subscribe, propertiesStore.get, propertiesStore.get);
}

export function useProperty(id: string): Property | undefined {
  const all = useProperties();
  return all.find(p => p.id === id);
}
