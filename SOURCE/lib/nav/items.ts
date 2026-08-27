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

export type NavItem = {
  key: MessageKey;
  href: string;
  /**
   * Đích này nằm SAU đăng nhập (không có trong `PUBLIC_PATHS` của
   * `lib/supabase/middleware.ts`). Ghim bằng máy ở `__tests__/items.test.ts`
   * — hai danh sách lệch nhau thì test đỏ, không phải người đi rà.
   *
   * Dùng để TẮT PREFETCH cho khách chưa đăng nhập (đo prod 2026-08-27):
   * `<Link>` của Next prefetch mọi đích trong vùng nhìn thấy, nên với khách,
   * mỗi đích có `guarded` sinh ra một 307 từ proxy rồi trình duyệt ĐI THEO
   * redirect sang `/?auth=signin` — tức MỘT LƯỢT RENDER SERVER ĐẦY ĐỦ cho một
   * trang người dùng không yêu cầu. Bốn mục dưới đây × (307 + render) = 13
   * lượt gọi function lãng phí trên MỖI lần khách mở trang chủ, và không có
   * gì trong số đó đi vào cache của lần điều hướng thật (đích thật là
   * `/?auth=signin`, không phải `/exams`). Cùng thứ lãng phí mà `app/robots.ts`
   * đã chặn cho crawler — chỉ khác là lần này site tự gây ra cho chính mình.
   */
  guarded?: boolean;
};

/** Năm đích chính. Đây cũng ĐÚNG là năm ô của BottomNav trên mobile —
 *  §4.2 khuyến nghị bóc tách các phân hệ cốt lõi ra thanh đáy. */
export const NAV_ITEMS: NavItem[] = [
  { key: "nav.home", href: "/" },
  { key: "nav.exams", href: "/exams", guarded: true },
  { key: "nav.analytics", href: "/me/dashboard", guarded: true },
  { key: "nav.history", href: "/history", guarded: true },
  // UGC v2.0 (Task 6.1): Import→Upload cho MỌI user; KHÔNG có mục admin.
  { key: "nav.upload", href: "/upload", guarded: true },
];

/** Guest thấy thêm tag "Account" (→ mở form auth trong trang chủ).
 *  CỐ Ý chỉ dùng cho thanh điều hướng NGANG (header/sidebar), KHÔNG cho
 *  BottomNav: xem ghi chú ở BottomNav.tsx về việc giữ cố định 5 ô. */
export const GUEST_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  { key: "nav.account", href: "/?auth=signin" },
];

/**
 * Giá trị `prefetch` cho `<Link>` của một mục nav.
 *
 * `false` CHỈ với khách chưa đăng nhập trên đích sau-đăng-nhập (xem `guarded`).
 * Người đã đăng nhập giữ nguyên prefetch: với họ đích là thật, 307 không xảy
 * ra, và prefetch làm đúng việc nó sinh ra để làm.
 *
 * Trả `undefined` chứ không phải `true` cho nhánh còn lại — để `<Link>` giữ
 * mặc định của Next (prefetch theo viewport + heuristic của nó) thay vì ta ép
 * một giá trị và vô tình khoá luôn hành vi đó lại.
 */
export function navPrefetch(item: NavItem, signedIn: boolean): false | undefined {
  return !signedIn && item.guarded ? false : undefined;
}

/** Mục nào đang được chọn, theo `pathname` hiện tại.
 *  "/" phải so BẰNG chứ không `startsWith` — nếu không thì mọi route đều khớp
 *  trang chủ và luôn có hai mục cùng sáng. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/** Màn ĐANG LÀM BÀI — `/exams/{id}/attempt/{attemptId}` và chỉ đúng nó.
 *
 *  Dưới 768px route này chạy ở chế độ TẬP TRUNG: cả SiteHeader lẫn BottomNav
 *  đều không hiện. Lý do là chi phí chiều cao — ở 390×844 hai thanh đó ăn
 *  60 + 56 = 116px, tức 14% màn hình, cho một trang mà người dùng đến để làm
 *  đúng MỘT việc và không được rời đi ngoài ý muốn (đã có sẵn hộp thoại xác
 *  nhận rời trang). Đổi lại, ExamPlayer phải tự mọc một lối quay về
 *  /exams — không có thanh điều hướng nào để dựa vào nữa.
 *
 *  Khớp CHÍNH XÁC, không `startsWith`: `.../result` và `.../result/detail`
 *  nằm dưới cùng tiền tố nhưng là trang XEM KẾT QUẢ — bài đã nộp xong, không
 *  còn gì để tập trung, và người dùng ở đó cần điều hướng bình thường.
 *
 *  Đặt ở đây cùng `isNavItemActive` vì cùng một lý do: hai thanh điều hướng
 *  phải quyết định GIỐNG HỆT nhau. Hai bản so khớp riêng thì sẽ có ngày một
 *  thanh biến mất còn thanh kia ở lại. */
const EXAM_ATTEMPT_PATH = /^\/exams\/[^/]+\/attempt\/[^/]+$/;

export function isExamFocusRoute(pathname: string): boolean {
  return EXAM_ATTEMPT_PATH.test(pathname);
}
