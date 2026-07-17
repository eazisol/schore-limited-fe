import { useEffect, useRef, useState } from "react";

export function useDebouncedSearch(options?: {
  delayMs?: number;
  initialValue?: string;
  onPageReset?: () => void;
}) {
  const delayMs = options?.delayMs ?? 300;
  const onPageResetRef = useRef(options?.onPageReset);
  const [searchInput, setSearchInput] = useState(options?.initialValue ?? "");
  const [search, setSearch] = useState(options?.initialValue?.trim() ?? "");

  useEffect(() => {
    onPageResetRef.current = options?.onPageReset;
  }, [options?.onPageReset]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (prev === next) return prev;
        onPageResetRef.current?.();
        return next;
      });
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [delayMs, searchInput]);

  return {
    searchInput,
    setSearchInput,
    search,
    clearSearch: () => setSearchInput(""),
  };
}
