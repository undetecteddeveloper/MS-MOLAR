// SkipLink — "Tới nội dung chính" cho người dùng bàn phím (WCAG 2.4.1 Bypass
// Blocks). Phải là phần tử focus được ĐẦU TIÊN trong DOM của mỗi khung layout,
// đặt TRƯỚC navbar. Ẩn bằng sr-only, hiện như một viên thuốc xanh khi nhận tiêu
// điểm — KHÔNG dùng `display: none` vì thứ đó ẩn luôn khỏi thứ tự Tab.
//
// Đích nhảy là `#main-content` — id trên khối nội dung của mỗi layout, mang
// tabIndex={-1} để trình duyệt thực sự dời tiêu điểm vào nó.

import { t } from "@/lib/copy";

export async function SkipLink() {
  return (
    <a
      href="#main-content"
      className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only rounded-full px-4 py-2.5 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus-visible:ring-3"
    >
      {t("common.skipToContent")}
    </a>
  );
}
