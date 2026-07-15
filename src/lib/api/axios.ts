import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";

/**
 * Centralised Axios instance for the Schore platform.
 *
 * Base URL comes from `VITE_API_BASE_URL`. All feature-level
 * services (`src/lib/api/services/*`) MUST import `api` from here — never
 * call `axios` directly, never hard-code the base URL elsewhere.
 *
 * Responsibilities of this module:
 *   1. Provide one configured instance (`api`).
 *   2. Attach the auth token from the token store on every request.
 *   3. Normalise responses (`response.data` -> handler value).
 *   4. Centralise error handling: 401 -> emit unauthorized signal,
 *      network / 5xx -> toast, everything else -> throw a normalised error.
 *
 * Token storage is intentionally decoupled from React so this file works
 * both inside and outside components (loaders, effects, event handlers).
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "https://schore.yehtohoga.com/api/";

/* ----------------------------- token store ----------------------------- */

const TOKEN_KEY = "schore.api.token.v1";

type TokenListener = (token: string | null) => void;
const tokenListeners = new Set<TokenListener>();

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(TOKEN_KEY) ??
      window.sessionStorage.getItem(TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

let currentToken: string | null = readToken();

export const tokenStore = {
  get: () => currentToken,
  set(token: string | null, remember = true) {
    currentToken = token;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(TOKEN_KEY);
      if (token) {
        const store = remember ? window.localStorage : window.sessionStorage;
        store.setItem(TOKEN_KEY, token);
      }
    } catch {
      /* storage disabled — ignore */
    }
    tokenListeners.forEach(l => l(token));
  },
  clear() {
    this.set(null);
  },
  subscribe(l: TokenListener) {
    tokenListeners.add(l);
    return () => {
      tokenListeners.delete(l);
    };
  },
};

/* --------------------------- unauthorized bus --------------------------- */

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Subscribe to 401 responses (used by AuthContext to sign the user out). */
export function onUnauthorized(l: UnauthorizedListener) {
  unauthorizedListeners.add(l);
  return () => {
    unauthorizedListeners.delete(l);
  };
}

/* ------------------------------ error type ------------------------------ */

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
  isNetworkError: boolean;
  original: unknown;
}

function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<any>;
    const status = ax.response?.status ?? 0;
    const data = ax.response?.data;
    const message =
      (data && typeof data === "object" && (data.message || data.error)) ||
      ax.message ||
      "Request failed";
    return {
      status,
      message: String(message),
      code: ax.code,
      details: data,
      isNetworkError: !ax.response,
      original: err,
    };
  }
  return {
    status: 0,
    message: err instanceof Error ? err.message : "Unknown error",
    isNetworkError: true,
    original: err,
  };
}

/* ------------------------------ instance ------------------------------ */

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { Accept: "application/json" },
});

// Request interceptor — attach bearer token, JSON content-type by default.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const headers = AxiosHeaders.from(config.headers);
  const token = tokenStore.get();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    config.data &&
    !(config.data instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  config.headers = headers;
  return config;
});

// Response interceptor — normalise + centralise errors.
api.interceptors.response.use(
  response => response,
  (error: unknown) => {
    const apiError = toApiError(error);

    // 401 — token invalid/expired. Emit signal, don't toast (AuthContext handles UX).
    if (apiError.status === 401) {
      tokenStore.clear();
      unauthorizedListeners.forEach(l => l());
    }
    // 403 — permission denied.
    else if (apiError.status === 403) {
      toast.error("You don't have permission to perform this action.");
    }
    // 5xx — server error.
    else if (apiError.status >= 500) {
      toast.error("Server error. Please try again in a moment.");
    }
    // Network / timeout.
    else if (apiError.isNetworkError) {
      toast.error("Network error. Check your connection and try again.");
    }

    return Promise.reject(apiError);
  },
);

/* ------------------------------ helpers ------------------------------ */

/** Unwrap `response.data` for the common case of typed JSON responses. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await api.request<T>(config);
  return res.data;
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: "GET" }),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: "DELETE" }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: "POST", data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: "PUT", data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: "PATCH", data }),
};
