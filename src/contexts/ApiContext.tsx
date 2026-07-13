import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, http, type ApiError } from "@/lib/api/axios";

interface ApiContextValue {
  /** The shared axios instance (rare — prefer `http` helpers or services). */
  api: typeof api;
  /** Typed helpers: `http.get<T>(url)` etc. */
  http: typeof http;
  /** Number of in-flight requests tracked via `track()`. */
  pendingCount: number;
  /** True while any tracked request is in flight. */
  isLoading: boolean;
  /** The most recent error surfaced through `track()` (cleared on next success). */
  lastError: ApiError | null;
  /** Wrap a promise to feed `isLoading` / `lastError`. */
  track: <T>(promise: Promise<T>) => Promise<T>;
  clearError: () => void;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPending] = useState(0);
  const [lastError, setLastError] = useState<ApiError | null>(null);
  const mounted = useRef(true);

  const track = useCallback(async <T,>(promise: Promise<T>): Promise<T> => {
    setPending(c => c + 1);
    try {
      const value = await promise;
      if (mounted.current) setLastError(null);
      return value;
    } catch (err) {
      if (mounted.current) setLastError(err as ApiError);
      throw err;
    } finally {
      if (mounted.current) setPending(c => Math.max(0, c - 1));
    }
  }, []);

  const value = useMemo<ApiContextValue>(
    () => ({
      api,
      http,
      pendingCount,
      isLoading: pendingCount > 0,
      lastError,
      track,
      clearError: () => setLastError(null),
    }),
    [pendingCount, lastError, track],
  );

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used inside <ApiProvider>");
  return ctx;
}
