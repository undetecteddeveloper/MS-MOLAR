// Nhãn trạng thái của một đơn thanh toán. Bốn giá trị hợp lệ khớp ràng buộc
// CHECK của `payment_orders.status`; mọi giá trị khác hiện nhãn "không nhận ra"
// thay vì bị ép về một trạng thái thật — trên màn hình tiền, nhãn sai là bảo
// người đã trả đi trả lần nữa.

import { Badge } from "@/components/ui/badge";
import { t, type MessageKey } from "@/lib/copy";

type OrderStatus = "pending" | "paid" | "expired" | "cancelled";
type BadgeVariant = "muted" | "success" | "sun" | "wrong";

const CONFIG: Record<OrderStatus, { labelKey: MessageKey; variant: BadgeVariant }> = {
  pending: { labelKey: "billing.status.pending", variant: "sun" },
  paid: { labelKey: "billing.status.paid", variant: "success" },
  expired: { labelKey: "billing.status.expired", variant: "muted" },
  cancelled: { labelKey: "billing.status.cancelled", variant: "muted" },
};

function isOrderStatus(value: string): value is OrderStatus {
  return value in CONFIG;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const { labelKey, variant } = isOrderStatus(status)
    ? CONFIG[status]
    : { labelKey: "billing.status.unrecognised" as const, variant: "wrong" as const };
  return <Badge variant={variant}>{t(labelKey)}</Badge>;
}
