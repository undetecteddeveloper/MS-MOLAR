// Nguồn chân lý DUY NHẤT cho các đích điều hướng chính của site.
//
// Trước đây danh sách này được chép nguyên văn ở HAI chỗ (SiteHeader.tsx và
// HomeSidebar.tsx) kèm bình luận "đồng bộ 100%" — tức là sự đồng bộ được bảo
// đảm bằng lời hứa chứ không bằng cấu trúc. Khi thêm BottomNav (bố cục mobile
// bottom-heavy, tài liệu Mobile-Layout-Research-MS §4.2) thì sẽ thành BA bản
// chép, và ba bản chép của cùng một danh sách là chuyện chỉ có thể lệch nhau
// theo thời gian, không thể tự khớp lại.
//
// `isNavItemActive` cũng nằm ở đây vì cùng lý do: SiteHeader đã có sẵn một bản
// so khớp (`href === "/" ? pathname === "/" : pathname.startsWith(href)`), và
// nếu BottomNav tự viết bản thứ hai thì hai thanh điều hướng cùng hiển thị
// trên một màn hình có thể tô sáng HAI mục khác nhau — một bug im lặng, không
// crash, chỉ khiến người dùng không tin cái nào nữa.

import type { MessageKey } from "@/lib/i18n/translate";

export type NavItem = { key: MessageKey; href: string };

/** Năm đích chính. Đây cũng ĐÚNG là năm ô của BottomNav trên mobile —
 *  §4.2 khuyến nghị bóc tách các phân hệ cốt lõi ra thanh đáy. */
export const NAV_ITEMS: NavItem[] = [
  { key: "nav.home", href: "/" },
  { key: "nav.exams", href: "/exams" },
  { key: "nav.analytics", href: "/me/dashboard" },
  { key: "nav.history", href: "/history" },
  // UGC v2.0 (Task 6.1): Import→Upload cho MỌI user; KHÔNG có mục admin.
  { key: "nav.upload", href: "/upload" },
];

/** Guest thấy thêm tag "Account" (→ mở form auth trong trang chủ).
 *  CỐ Ý chỉ dùng cho thanh điều hướng NGANG (header/sidebar), KHÔNG cho
 *  BottomNav: xem ghi chú ở BottomNav.tsx về việc giữ cố định 5 ô. */
export const GUEST_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  { key: "nav.account", href: "/?auth=signin" },
];

/** Mục nào đang được chọn, theo `pathname` hiện tại.
 *  "/" phải so BẰNG chứ không `startsWith` — nếu không thì mọi route đều khớp
 *  trang chủ và luôn có hai mục cùng sáng. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}
