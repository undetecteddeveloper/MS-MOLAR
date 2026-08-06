// SkipLink — "Skip to content" cho người dùng bàn phím (WCAG 2.4.1 Bypass
// Blocks). Trước đây site không có: mỗi lần đổi trang, người dùng bàn phím
// phải Tab qua toàn bộ 5–6 tag điều hướng (giống hệt nhau ở mọi trang) mới
// chạm được nội dung.
//
// Phải là phần tử focus được ĐẦU TIÊN trong DOM của mỗi khung layout, đặt
// TRƯỚC navbar/sidebar. Ẩn khỏi mắt thường bằng sr-only, hiện ra như một khối
// đặc khi nhận tiêu điểm (`focus:not-sr-only`) — KHÔNG dùng `display: none` vì
// thứ đó cũng ẩn luôn khỏi thứ tự Tab, làm liên kết trở nên vô dụng.
//
// Đích nhảy tới là `#main-content` — id gắn trên khối nội dung của mỗi layout
// (xem (layer2|3|4|HM)/layout.tsx và app/page.tsx). Khối đó mang tabIndex={-1}
// để trình duyệt thực sự dời tiêu điểm vào nó; không có tabIndex, một số trình
// duyệt chỉ cuộn màn hình mà tiêu điểm vẫn nằm lại ở navbar.

import { getTranslate } from "@/lib/i18n/server";

export async function SkipLink() {
  const t = await getTranslate();
  return (
    <a
      href="#main-content"
      className="bg-background text-foreground sr-only rounded-md border-2 border-[color:var(--ring)] px-4 py-2 font-sans text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
    >
      {t("common.skipToContent")}
    </a>
  );
}
