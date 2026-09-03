// C-07 OrderList — danh sách đơn của chính người dùng (UI Spec § Component:
// `OrderList`; frontend DD § Main Components). Server component.
//
// BẤT BIẾN, chép nguyên tinh thần `HistoryList.tsx:11-13` khai cho chính nó:
// component này KHÔNG BAO GIỜ tự sắp lại hay tự lọc `orders`. Thứ tự thuộc về
// TẦNG TRUY VẤN — `listMyOrders()` khai `.order("created_at", { ascending:
// false })` khớp thẳng chỉ mục `payment_orders_user_created_idx`. Một lượt sắp
// thứ hai ở đây là đúng lỗi mà bất biến này sinh ra để chặn: "mới nhất trước"
// đúng ở một chỗ và sai ở chỗ kia, và không chỗ nào báo lỗi.
//
// KHÔNG TRẦN CHIỀU CAO, KHÔNG CUỘN BÊN TRONG — và đây là chỗ CỐ Ý KHÁC
// `HistoryList`. `HistoryList` chặn chiều cao vì `/history` còn nội dung bên
// dưới; `/me/orders` thì không, và một danh sách CHỨNG TỪ THANH TOÁN cuộn bên
// trong sẽ giấu những đơn CŨ NHẤT sau một thanh cuộn mà không ai ngờ tới.
//
// RỖNG LÀ MỘT TRẠNG THÁI THẬT, THƯỜNG GẶP, VÀ KHÔNG PHẢI LỖI. Phần lớn người
// mở màn này chưa từng mua gì. Khung viền đứt (idiom `HistoryList.tsx:29`) giải
// thích màn hình và mời sang `/pricing`; nó KHÔNG mang `role="alert"` — đây là
// trạng thái có sẵn lúc mount, mà một alert lúc mount thì ngắt lời trình đọc
// màn hình để thông báo... không có gì thay đổi cả.
import Link from "next/link";
import type { MyOrderRow } from "@/features/billing/queries";
import { getTranslate } from "@/lib/i18n/server";
import { OrderRow } from "@/features/billing/components/orders/OrderRow";

export async function OrderList({ orders }: { orders: MyOrderRow[] }) {
  const t = await getTranslate();

  if (orders.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-foreground font-serif text-lg">{t("billing.orders.empty")}</p>
        <p className="text-muted-foreground text-sm">{t("billing.orders.emptyHint")}</p>
        {/* `min-h-11`: đích chạm 44px, cùng khuôn liên kết `/pricing` đã ship ở
            ExplainStepAffordance.tsx:121-126 — nhãn cũng dùng lại khoá của nó,
            không đẻ thêm một câu thứ hai cho cùng một đích. */}
        <Link
          href="/pricing"
          className="text-brand mt-2 inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
        >
          {t("billing.quota.upgradeLink")}
        </Link>
      </div>
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
