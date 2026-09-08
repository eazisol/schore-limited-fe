import { useCallback, useRef, useState } from "react";
import { RateCapReasonModal } from "@/components/rates/RateCapReasonModal";
import { toApiError } from "@/lib/api/axios";

const REASON_REQUIRED_SNIPPET = "reason is required when a rate exceeds";

export function isRateCapReasonRequiredError(err: unknown): boolean {
  const message = toApiError(err).message?.toLowerCase() ?? "";
  return message.includes(REASON_REQUIRED_SNIPPET);
}

type ValuesWithReason = { rateChangeReason?: string | null };

/**
 * Save helper: if backend says cap-exceed reason is required, open the reason modal and retry.
 */
export function useRateCapReasonGate() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const resolveRef = useRef<((reason: string | null) => void) | null>(null);

  const promptReason = useCallback(() => {
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = useCallback((reason: string | null) => {
    setOpen(false);
    resolveRef.current?.(reason);
    resolveRef.current = null;
  }, []);

  const runWithCapReason = useCallback(
    async <TValues extends ValuesWithReason, TResult>(
      values: TValues,
      mutate: (next: TValues) => Promise<TResult>,
    ): Promise<TResult | undefined> => {
      try {
        return await mutate(values);
      } catch (err) {
        if (!isRateCapReasonRequiredError(err) || Boolean(values.rateChangeReason?.trim())) {
          throw err;
        }
        const reason = await promptReason();
        if (!reason) return undefined;
        setPending(true);
        try {
          return await mutate({ ...values, rateChangeReason: reason });
        } finally {
          setPending(false);
        }
      }
    },
    [promptReason],
  );

  const modal = (
    <RateCapReasonModal
      open={open}
      pending={pending}
      onCancel={() => close(null)}
      onConfirm={(reason) => close(reason)}
    />
  );

  return { runWithCapReason, modal };
}
