import { DetailMetaRow } from "@/components/DetailField";
import { fmtGBP } from "@/lib/data";
import { formatDateTime } from "@/lib/module-ui";

export function TradeGroupRecordPanel({
  tradeGroupId,
  createdDate,
  editDate,
  totalPrice,
}: {
  tradeGroupId?: number | null;
  createdDate?: string | null;
  editDate?: string | null;
  totalPrice: number;
}) {
  return (
    <div className="card-elevated self-start p-4 sm:p-6">
      <h3 className="mb-4 font-display font-semibold">Record</h3>
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
