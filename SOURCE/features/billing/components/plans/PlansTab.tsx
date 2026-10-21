// Nội dung tab "Gói" của /profile: dải gói đang dùng, thẻ mua, rồi "Lịch sử mua".
//
// Server Component async — trang hồ sơ chỉ gọi nó khi `?tab=plans`, nên lượt đọc
// danh sách đơn không đè lên các tab khác. Lượt đọc đơn HỎNG thì chỉ phần Lịch sử
// mua báo lỗi, KHÔNG kéo cả tab (và nút mua) xuống error.tsx: "không đọc được"
// khác "chưa có đơn nào", nên không dịch cái trước thành cái sau.

import { Card } from "@/components/ui/card";
import { isPaidTierEnabled } from "@/lib/billing/paidTier";
import { t } from "@/lib/copy";
import { listMyOrders, type MyOrderRow } from "@/features/billing/queries";
import { OrderList } from "@/features/billing/components/orders/OrderList";
import { PlanStatusStrip } from "@/features/billing/components/plans/PlanStatusStrip";
import { PurchaseCard } from "@/features/billing/components/plans/PurchaseCard";

async function tryListMyOrders(): Promise<MyOrderRow[] | null> {
  try {
    return await listMyOrders();
  } catch (err) {
    console.error("[PlansTab] listMyOrders threw", {
      digest: (err as { digest?: string } | null)?.digest,
    });
    return null;
  }
}

export async function PlansTab() {
  // `isPaidTierEnabled()` đọc env lúc render: trang hồ sơ vốn động (cookie +
  // searchParams) nên cờ không bị đông cứng lúc build.
  const canPurchase = isPaidTierEnabled();
  const orders = await tryListMyOrders();

  return (
    <div className="flex flex-col gap-6">
      <PlanStatusStrip />
      <PurchaseCard canPurchase={canPurchase} />

      <section aria-labelledby="orders-title" className="flex flex-col gap-3">
        <h2 id="orders-title" className="text-lg font-semibold">
          {t("billing.orders.title")}
        </h2>
        {orders === null ? (
          <Card variant="outline" className="border-dashed">
            <p role="alert" className="text-destructive text-sm leading-relaxed">
              {t("billing.orders.loadError")}
            </p>
          </Card>
        ) : (
          <OrderList orders={orders} />
        )}
      </section>
    </div>
  );
}
