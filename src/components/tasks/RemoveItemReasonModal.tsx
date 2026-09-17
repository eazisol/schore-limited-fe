import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const REASON_MAX = 500;

type Props = {
  open: boolean;
  pending?: boolean;
  itemLabel?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

/** Collects a required reason before removing a job / day item. */
export function RemoveItemReasonModal({
  open,
  pending = false,
  itemLabel,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const tooLong = reason.length > REASON_MAX;

  useEffect(() => {
    if (open) setReason("");
  }, [open, itemLabel]);

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onCancel}
      title="Remove item"
      size="sm"
      showCloseButton={!pending}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending || !trimmed || tooLong}
            onClick={() => onConfirm(trimmed)}
          >
            {pending ? "Removing…" : "Remove"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Enter a reason for removing this item. The reason is saved on the job timeline.
        </p>
        {itemLabel ? (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
            {itemLabel}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="remove-item-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="remove-item-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={REASON_MAX}
            disabled={pending}
            autoFocus
            placeholder="Why is this item being removed?"
          />
          <div className="text-right text-[11px] text-muted-foreground">
            {reason.length} / {REASON_MAX}
          </div>
        </div>
      </div>
    </Modal>
  );
}
