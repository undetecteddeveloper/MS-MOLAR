// S-05 `/me/orders` — đơn hàng của tôi (UI Spec UI-D11, S-05; frontend DD
// § Main Components). Server component.
//
// CHỐT ĐĂNG NHẬP CHẠY TRƯỚC MỌI LƯỢT ĐỌC, khuôn của `(HM)/history/page.tsx` và
// `(layer4)/me/exams/page.tsx`. Thứ tự hai dòng đầu là điều kiện được nghiệm
// thu chứ không phải thói quen: một lượt `listMyOrders()` đứng trước chốt vẫn
// trả `[]` (RLS `orders_select_own` lọc sạch), nên màn hình trông vẫn đúng
// trong khi khách chưa đăng nhập đã kịp chạm vào database. Đích chuyển hướng là
// `/?auth=signin` — dialog đăng nhập trên trang chủ — KHÔNG phải `/login`, một
// route không tồn tại trong repo này.
//
// Route nằm dưới `(billing)` chứ không phải `(analytics)` nơi `/me/dashboard` đang
// ở: `(billing)/layout.tsx` là chỗ DUY NHẤT trong repo mount
// `EntitlementProvider`, và `useEntitlement()` ngoài provider trả `FREE_FALLBACK`
// — không ném, không cảnh báo, không phân biệt được với một người dùng Free
// thật (UI-D11). C-11 `PlanSummary` đứng giữa PageHeader và danh sách, và nó
// phụ thuộc hoàn toàn vào provider đó: đặt nhầm route group thì màn hình này
// vẫn render trọn vẹn, chỉ là mọi người dùng Premium đọc được bảng tóm tắt của
// người dùng Free.
//
// KHÔNG có lượt sắp xếp nào ở đây, cũng không ở C-07: `listMyOrders()` đã khai
// thứ tự bằng SQL, đúng một lần.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listMyOrders } from "@/app/(billing)/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTranslate } from "@/lib/i18n/server";
import { OrderList } from "./_components/OrderList";
import { PlanSummary } from "./_components/PlanSummary";

export const metadata: Metadata = { title: "Your orders" };

export default async function MyOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const t = await getTranslate();
  const orders = await listMyOrders();

  // `size="default"` + padding mặc định — và hai file biên (`loading.tsx`,
  // `error.tsx`) phải khớp ĐÚNG cặp này, nếu không nội dung sẽ giật đúng lúc
  // skeleton được thay bằng dữ liệu (UI-D18).
  return (
    <PageContainer as="main" size="default" className="flex flex-col gap-6">
      <PageHeader title={t("billing.orders.title")} />
      {/* NGOÀI OrderList, không phải trong: một người chưa mua gì vẫn phải thấy
          đủ bốn giá trị của AC-056 (UI Spec § C-11). Không props — C-11 đọc
          thẳng `useEntitlement()`. */}
      <PlanSummary />
      <OrderList orders={orders} />
    </PageContainer>
  );
}
