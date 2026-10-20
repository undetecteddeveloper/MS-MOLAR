// Danh sách đơn của chính người dùng. KHÔNG tự sắp xếp/lọc: thứ tự thuộc về
// `listMyOrders()` (SQL, mới nhất trước). Không cuộn bên trong — danh sách
// chứng từ thanh toán không được giấu đơn cũ sau một thanh cuộn.

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import type { MyOrderRow } from "@/features/billing/queries";
import { OrderRow } from "@/features/billing/components/orders/OrderRow";

export function OrderList({ orders }: { orders: MyOrderRow[] }) {
  if (orders.length === 0) {
    return (
      <Card variant="outline" className="items-center gap-1 border-dashed px-6 py-12 text-center">
        <h2 className="text-lg font-semibold">{t("billing.orders.empty")}</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          {t("billing.orders.emptyHint")}
        </p>
        <Link href="/pricing" className={buttonVariants({ className: "mt-3" })}>
          {t("billing.quota.upgradeLink")}
        </Link>
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
