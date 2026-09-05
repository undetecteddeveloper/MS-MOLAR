// AboutPrompt — lối vào /about ở chân trang chủ.
//
// /about công khai (PRD R10) nhưng KHÔNG có mục nào trong NAV_ITEMS trỏ tới nó:
// danh sách đó là năm đích chính và cũng ĐÚNG là năm ô của BottomNav — nhét mục
// thứ sáu vào là đổi bố cục thanh đáy toàn site để phục vụ một liên kết chỉ
// xuất hiện ở trang chủ. Đặt ở chân trang chủ, chỗ mắt nghỉ sau khi đọc xong.
//
// Server component: chỗ mount (app/page.tsx) là server, không tốn byte JS nào.

import Link from "next/link";
import { t } from "@/lib/copy";

export async function AboutPrompt() {
  return (
    <Link
      href="/about"
      // min-h-11: sàn 44px cho đích chạm — chữ 14px một dòng chỉ cao ~20px.
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg text-sm font-medium underline decoration-1 underline-offset-4 transition-colors focus-visible:ring-3 focus-visible:outline-none"
    >
      {t("home.about")}
    </Link>
  );
}
