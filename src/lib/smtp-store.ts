import { useSyncExternalStore } from "react";

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  encryption: "none" | "ssl" | "tls";
  enabled: boolean;
}

const KEY = "schore.smtp.v1";

const defaults: SmtpConfig = {
  host: "",
  port: 587,
  username: "",
  password: "",
  fromName: "Schore Limited",
  fromEmail: "no-reply@schore.co.uk",
  encryption: "tls",
  enabled: false,
};

function load(): SmtpConfig {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch { return defaults; }
}

let cfg: SmtpConfig = load();
const listeners = new Set<() => void>();
const emit = () => {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
  }
  listeners.forEach(l => l());
};

export const smtpStore = {
  get: () => cfg,
  update: (patch: Partial<SmtpConfig>) => { cfg = { ...cfg, ...patch }; emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useSmtp() {
  return useSyncExternalStore(smtpStore.subscribe, smtpStore.get, smtpStore.get);
}
