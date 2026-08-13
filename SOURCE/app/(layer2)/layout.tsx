// Layout route group (layer2) — khung chung cho MỌI trang Layer 2.
// Theme dùng thẳng root "Mực & Sơn mài" (globals.css, S#17) — không còn scope
// .theme-l2 riêng; navbar đen sơn mài lấy từ biến --nav-* mặc định.
//
// SiteHeader render Ở ĐÂY (1 lần cho mọi trang L2) thay vì lặp lại trong từng
// page — tránh phải truyền `user` prop xuyên qua ExamPlayer (client component)
// và tránh fetch getCurrentUserProfile() nhiều lần mỗi navigation. Các trang
// con KHÔNG còn tự render <SiteHeader/> nữa (đã gỡ), chỉ giữ `bg-background`
// (bỏ `min-h-dvh` — layout này gánh min-h-dvh, tránh cộng dồn chiều cao với
// header 56px gây scrollbar thừa, giống bug đã gặp ở M3.3 homepage).
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { SkipLink } from "@/components/shared/SkipLink";
import { SupportWidget } from "@/components/support/SupportWidget";

export default async function Layer2Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserProfile();

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <SiteHeader user={user} />
      {/* id + tabIndex={-1}: đích nhảy của SkipLink (WCAG 2.4.1). tabIndex âm
          cho phép nhận tiêu điểm bằng lập trình mà không chen vào thứ tự Tab. */}
      {/* pb-bottom-nav: chừa chỗ cho BottomNav (fixed) để dòng cuối của trang
          không chui xuống dưới nó. Tự về 0 từ 768px vì thanh đáy không render. */}
      <div id="main-content" tabIndex={-1} className="pb-bottom-nav">
        {children}
      </div>
      <BottomNav />
      <SupportWidget user={user} />
    </div>
  );
}
