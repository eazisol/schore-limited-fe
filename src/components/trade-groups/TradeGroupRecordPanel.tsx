import { DetailMetaRow } from "@/components/DetailField";
import { fmtGBP } from "@/lib/data";
import { formatDateTime } from "@/lib/module-ui";

export function TradeGroupRecordPanel({
  tradeGroupId,
  createdDate,
  editDate,
  totalPrice,
  embedded = false,
}: {
  tradeGroupId?: string | null;
  createdDate?: string | null;
  editDate?: string | null;
  totalPrice: number;
  embedded?: boolean;
}) {
  return (
    <div
      className={
        embedded
          ? "rounded-lg border border-border bg-muted/20 p-4 sm:p-5"
          : "card-elevated self-start p-4 sm:p-6"
      }
    >
      <dl className="space-y-3">
        <DetailMetaRow label="Trade group ID">
          {tradeGroupId != null ? tradeGroupId : "—"}
        </DetailMetaRow>
        <DetailMetaRow label="Created">
          {createdDate ? formatDateTime(createdDate) : "—"}
        </DetailMetaRow>
        <DetailMetaRow label="Last edited">
          {editDate ? formatDateTime(editDate) : "—"}
        </DetailMetaRow>
        <DetailMetaRow label="Total price">
          <span className="font-mono tabular-nums">{fmtGBP(totalPrice)}</span>
        </DetailMetaRow>
      </dl>
    </div>
  );
}
