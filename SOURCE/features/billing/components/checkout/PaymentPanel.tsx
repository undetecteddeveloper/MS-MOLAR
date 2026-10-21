// Khối dữ liệu của màn thanh toán.
//
// MỘT cổng duy nhất: `isPayable()` (so sát `status === "pending"`). QR + khối
// chuyển khoản chỉ hiện khi đơn còn nhận tiền — bày hướng dẫn chuyển khoản cho
// một đơn đã đóng hoặc trạng thái lạ là mời người dùng trả tiền lần hai. Hàm
// được export để page.tsx dùng lại chính nó khi quyết định có hiện nút xác nhận.
//
// Hạn chót là mốc tuyệt đối của DÒNG, không phải đồng hồ đếm ngược: đơn được
// dùng lại chỉ còn phần hiệu lực còn lại, và người dùng đối chiếu với giờ trong
// app ngân hàng.

import Link from "next/link";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/billing/OrderStatusBadge";
import { RecheckOrderControl } from "@/components/billing/RecheckOrderControl";
import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";
import { t } from "@/lib/copy";
import { formatDateTime } from "@/lib/format/datetime";
import { TransferDetails } from "@/features/billing/components/checkout/TransferDetails";
import { VietQrCode } from "@/features/billing/components/checkout/VietQrCode";

export function isPayable(status: string): boolean {
  return status === "pending";
}

function OrderCodeLine({ orderCode }: { orderCode: number }) {
  return (
    <p className="text-muted-foreground text-sm">
      {t("billing.orders.orderCode")}{" "}
      {/* Nguyên si, không nhóm nghìn: người dùng đọc mã này cho hỗ trợ. */}
      <span className="text-foreground font-mono font-medium select-all">{String(orderCode)}</span>
    </p>
  );
}

export function PaymentPanel({ order }: { order: CheckoutOrder }) {
  if (!isPayable(order.status)) {
    return (
      <Card as="section" className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <OrderCodeLine orderCode={order.orderCode} />
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RecheckOrderControl orderCode={order.orderCode} variant="row" status={order.status} />
          <Link
            href="/me/orders"
            className="text-primary decoration-primary/40 hover:decoration-primary inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
          >
            {t("billing.orders.title")}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card as="section" className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <OrderCodeLine orderCode={order.orderCode} />
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          <Clock className="size-4" aria-hidden />
          {t("billing.checkout.validUntil", { time: formatDateTime(order.pendingUntil) })}
        </p>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
        <VietQrCode payload={order.qrPayload} />
        <TransferDetails
          accountNumber={order.accountNumber}
          accountName={order.accountName}
          amountVnd={order.amountVnd}
          memo={order.memo}
        />
      </div>
    </Card>
  );
}
