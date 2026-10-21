// Một đơn thanh toán. Nút hỏi lại có ở MỌI dòng, mọi trạng thái: "đơn trông
// như hết hạn vẫn có thể đã được trả" là lý do nút này tồn tại.
//
// "Tiếp tục thanh toán" chỉ hiện khi `pending` VÀ `pendingUntil` (mốc của dòng,
// không tính lại từ created_at) còn ở tương lai.

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/billing/OrderStatusBadge";
import { RecheckOrderControl } from "@/components/billing/RecheckOrderControl";
import { t } from "@/lib/copy";
import { formatDateTime } from "@/lib/format/datetime";
import { formatVnd } from "@/lib/format/number";
import type { MyOrderRow } from "@/features/billing/queries";

// Ngoài thân component: `react-hooks/purity` cấm gọi Date.now() lúc render.
function isWindowStillOpen(pendingUntil: string): boolean {
  return Date.parse(pendingUntil) > Date.now();
}

export function OrderRow({ order }: { order: MyOrderRow }) {
  const canContinuePaying = order.status === "pending" && isWindowStillOpen(order.pendingUntil);

  return (
    <Card
      as="li"
      padding="compact"
      className="gap-2 md:flex-row md:items-center md:justify-between md:gap-4"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground text-base font-semibold tabular-nums">
            {t("billing.amount", { amount: formatVnd(order.amountVnd) })}
          </p>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-muted-foreground text-xs leading-snug sm:text-sm">
          {t("billing.orders.createdAt")} {formatDateTime(order.createdAt)}
          <span aria-hidden> · </span>
          {t("billing.orders.orderCode")}{" "}
          <span className="font-mono select-all">{String(order.orderCode)}</span>
        </p>
      </div>

      {/* Nút căn PHẢI ở mọi cỡ (điện thoại: hàng riêng dưới thông tin, sát mép phải). */}
      <div className="flex flex-wrap items-center justify-end gap-x-2 md:shrink-0">
        {canContinuePaying && (
          <Link
            href={`/pricing/checkout?order=${order.orderCode}`}
            className="text-primary decoration-primary/40 hover:decoration-primary inline-flex min-h-11 items-center px-2 text-sm font-medium underline underline-offset-4"
          >
            {t("billing.orders.continuePaying")}
          </Link>
        )}
        <RecheckOrderControl orderCode={order.orderCode} variant="row" status={order.status} />
      </div>
    </Card>
  );
}
