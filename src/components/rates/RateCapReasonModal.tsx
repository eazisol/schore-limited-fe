import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const REASON_MAX = 500;

type Props = {
  open: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

/** Collects a reason when an operative rate exceeds the catalogue budget cap. */
export function RateCapReasonModal({ open, pending = false, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const tooLong = reason.length > REASON_MAX;

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onCancel}
      title="Reason for rate change"
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
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          One or more rates are above the parent budget (waterfall). Enter a reason to send them for
          approval. Rates within the parent cap are saved immediately.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="rate-cap-reason">Reason for rate change</Label>
          <Textarea
            id="rate-cap-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={REASON_MAX}
            disabled={pending}
            autoFocus
            placeholder="Why is this rate above the parent budget?"
          />
          <div className="text-right text-[11px] text-muted-foreground">
            {reason.length} / {REASON_MAX}
          </div>
        </div>
      </div>
    </Modal>
  );
}
