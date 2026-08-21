// AboutPrompt — lối vào /about ở góc dưới-trái màn hình trang chủ.
//
// /about đã tồn tại và công khai từ trước (PRD R10), nhưng KHÔNG có mục nào
// trong NAV_ITEMS trỏ tới nó và cũng không có footer nào trên trang chủ — tức
// là chỉ ai biết sẵn đường dẫn mới tới được. Đây là câu mời, đặt ở chỗ mắt
// nghỉ lại sau khi đọc xong hero.
//
// Vì sao KHÔNG thêm vào `lib/nav/items.ts`: danh sách đó là năm đích chính, và
// nó cũng ĐÚNG là năm ô của BottomNav trên mobile (xem ghi chú trong chính file
// đó). Nhét mục thứ sáu vào là đổi bố cục thanh đáy của toàn site để phục vụ
// một liên kết chỉ xuất hiện ở trang chủ.
//
// Chỗ đặt: mép TRÁI-DƯỚI của CONTENT AREA (nền ngà), không phải của sidebar.
// Sidebar chỉ tồn tại từ 1024px trở lên — đặt ở đó thì người dùng di động,
// nhóm đông nhất của dự án, không bao giờ thấy liên kết này.
//
// Server component: chỗ mount (app/page.tsx) là server, nên câu chữ này không
// tốn byte JS nào.

import Link from "next/link";
import { getTranslate } from "@/lib/i18n/server";

export async function AboutPrompt() {
  const t = await getTranslate();

  return (
    <Link
      href="/about"
      // min-h-11: sàn 44px cho đích chạm (Mobile-Layout-Research-MS §4.3) —
      // chữ 12px hai dòng vẫn có thể hụt trên màn rất hẹp.
      // max-w-sm: câu này dài, để nó trải hết bề ngang content area ở desktop
      // sẽ thành một dòng chữ mảnh vắt ngang chân trang, đọc như footer chứ
      // không như một lời mời.
      className="focus-visible:ring-ring inline-flex min-h-11 max-w-sm items-center rounded-[4px] font-sans text-xs leading-[1.5] tracking-[0.04em] text-balance text-[#1B1512]/70 underline decoration-1 underline-offset-4 transition-colors hover:text-[color:var(--brand)] focus-visible:ring-3 focus-visible:outline-none"
    >
      {t("home.aboutPrompt")}
    </Link>
  );
}
