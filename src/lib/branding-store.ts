import { useSyncExternalStore } from "react";

export interface BrandingConfig {
  appName: string;
  tagline: string;
  supportEmail: string;
  logo: string; // data URL (base64)
}

const KEY = "schore.branding.v1";

const defaults: BrandingConfig = {
  appName: "Schore Limited",
  tagline: "Workforce & Payroll",
  supportEmail: "support@schore.co.uk",
  logo: "",
};

function load(): BrandingConfig {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch { return defaults; }
}

let cfg: BrandingConfig = load();
const listeners = new Set<() => void>();
const emit = () => {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
  }
  listeners.forEach(l => l());
};

export const brandingStore = {
  get: () => cfg,
  update: (patch: Partial<BrandingConfig>) => { cfg = { ...cfg, ...patch }; emit(); },
  reset: () => { cfg = { ...defaults }; emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useBranding() {
  return useSyncExternalStore(brandingStore.subscribe, brandingStore.get, brandingStore.get);
}
