// Khối CHỮ chuyển khoản — đường trả tiền chính, không phải chú thích cho QR.
// Bốn dòng theo thứ tự: số tài khoản → chủ tài khoản → số tiền → nội dung.
// Giá trị chọn được (`select-all`) để nhấn-giữ-chép trên điện thoại.
//
// Trường thiếu bị BỎ HẲN kèm câu cảnh báo, không để ô trống hay "—": người
// dùng sẽ tưởng mình bỏ sót và chuyển tiền sai.

import { Card } from "@/components/ui/card";
import { t, type MessageKey } from "@/lib/copy";
import { formatVnd } from "@/lib/format/number";
import { cn } from "@/lib/utils";

type Pair = { labelKey: MessageKey; value: string; mono: boolean; emphasis?: boolean };

function isBlank(value: string): boolean {
  return value.trim() === "";
}

export function TransferDetails({
  accountNumber,
  accountName,
  amountVnd,
  memo,
}: {
  accountNumber: string;
  accountName: string;
  amountVnd: number;
  memo: string;
}) {
  const pairs: Array<Pair | null> = [
    isBlank(accountNumber)
      ? null
      : { labelKey: "billing.checkout.account", value: accountNumber, mono: true },
    isBlank(accountName)
      ? null
      : { labelKey: "billing.checkout.accountName", value: accountName, mono: false },
    !Number.isFinite(amountVnd)
      ? null
      : {
          labelKey: "billing.checkout.amountLabel",
          value: t("billing.amount", { amount: formatVnd(amountVnd) }),
          mono: false,
          emphasis: true,
        },
    isBlank(memo) ? null : { labelKey: "billing.checkout.memo", value: memo, mono: true },
  ];

  const present = pairs.filter((pair): pair is Pair => pair !== null);
  const anyMissing = present.length !== pairs.length;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <dl className="divide-border flex flex-col divide-y">
        {present.map((pair) => (
          <div
            key={pair.labelKey}
            className="flex min-w-0 flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <dt className="text-muted-foreground shrink-0 text-sm">{t(pair.labelKey)}</dt>
            <dd
              className={cn(
                "text-foreground min-w-0 break-all select-all sm:text-right",
                pair.mono && "font-mono",
                pair.emphasis ? "text-lg font-bold" : "text-base font-medium"
              )}
            >
              {pair.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Chuyển thiếu nội dung thì tiền vẫn tới nhưng không khớp được đơn nào. */}
      {!isBlank(memo) && (
        <Card variant="sun" padding="compact">
          <p className="text-sm leading-relaxed font-medium">{t("billing.checkout.memoWarning")}</p>
        </Card>
      )}

      {anyMissing && (
        <p role="alert" className="text-destructive text-sm leading-relaxed font-medium">
          {t("billing.checkout.fieldMissing")}
        </p>
      )}
    </div>
  );
}
