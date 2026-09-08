import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const REASON_MAX = 500;

export type RateCapReasonContext = {
  productName: string;
  rate: number;
  cap: number;
};

type Props = {
  open: boolean;
  pending?: boolean;
  context?: RateCapReasonContext | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

function fmtGbp(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Collects a reason when a rate exceeds the parent budget cap (one item at a time). */
export function RateCapReasonModal({
  open,
  pending = false,
  context,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const tooLong = reason.length > REASON_MAX;

  useEffect(() => {
    if (open) setReason("");
  }, [open, context?.productName, context?.rate]);

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onCancel}
      title="Reason for rate above cap"
      size="sm"
      showCloseButton={!pending}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || !trimmed || tooLong}
            onClick={() => onConfirm(trimmed)}
          >
            Continue
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This rate is above the parent budget cap and will go to Rate approvals. Enter a reason for
          this item.
        </p>
        {context ? (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <div className="font-medium text-foreground">{context.productName || "Item"}</div>
            <div className="mt-1 text-muted-foreground">
              Rate {fmtGbp(context.rate)} · Cap {fmtGbp(context.cap)}
            </div>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="rate-cap-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="rate-cap-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={REASON_MAX}
            disabled={pending}
            autoFocus
            placeholder="Why is this item’s rate above the parent budget?"
          />
          <div className="text-right text-[11px] text-muted-foreground">
            {reason.length} / {REASON_MAX}
          </div>
        </div>
      </div>
    </Modal>
  );
}
