// Danh sách đơn của chính người dùng ("Lịch sử mua" ở tab Gói). KHÔNG tự sắp xếp/lọc:
// thứ tự thuộc về `listMyOrders()` (SQL, mới nhất trước). Không cuộn bên trong —
// danh sách chứng từ thanh toán không được giấu đơn cũ sau một thanh cuộn.

import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import type { MyOrderRow } from "@/features/billing/queries";
import { OrderRow } from "@/features/billing/components/orders/OrderRow";

export function OrderList({ orders }: { orders: MyOrderRow[] }) {
  if (orders.length === 0) {
    // Không có nút "Xem các gói": danh sách nằm NGAY dưới thẻ mua của tab Gói.
    return (
      <Card variant="outline" className="items-center gap-1 border-dashed px-6 py-10 text-center">
        <p className="text-lg font-semibold">{t("billing.orders.empty")}</p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          {t("billing.orders.emptyHint")}
        </p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {orders.map((order) => (
        <OrderRow key={order.orderCode} order={order} />
      ))}
    </ul>
  );
}
