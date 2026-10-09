/** Dispatched when any SearchableSelect / SearchableMultiSelect opens. */
export const SEARCHABLE_SELECT_OPEN_EVENT = "schore:searchable-select-open";

export function notifySearchableSelectOpened(instanceId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SEARCHABLE_SELECT_OPEN_EVENT, { detail: instanceId }),
  );
}

export function subscribeSearchableSelectOpened(
  instanceId: string,
  onOtherOpened: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail;
    if (detail !== instanceId) onOtherOpened();
  };

  window.addEventListener(SEARCHABLE_SELECT_OPEN_EVENT, handler);
  return () => window.removeEventListener(SEARCHABLE_SELECT_OPEN_EVENT, handler);
}
