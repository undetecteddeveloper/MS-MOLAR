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
import { readEntitlement } from "@/lib/billing/readEntitlement";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { SkipLink } from "@/components/shared/SkipLink";
import { SupportWidget } from "@/components/support/SupportWidget";

export default async function Layer2Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserProfile();
  // Đọc quyền lợi ĐÚNG MỘT LẦN cho cả nhánh cây, rồi truyền xuống bằng context
  // — cùng cách root layout làm với locale. Nhờ vậy `useEntitlement()` ở mọi
  // component con là một lượt đọc context, không phải một round-trip (UI-D1).
  //
  // KỶ LUẬT ĐI KÈM, và nó ràng buộc mọi thứ nằm DƯỚI file này: KHÔNG page hay
  // component nào bên dưới được gọi `readEntitlement()` — họ đọc context. Route
  // group là anh em chứ không lồng nhau, nên đúng một layout phân giải mỗi
  // request và đúng một lượt đọc được phát ra; một lượt gọi thứ hai không sai
  // về kết quả, chỉ là một round-trip thừa nằm sau mỗi lần render. Repo đã có
  // sẵn tiền lệ trôi đúng kiểu này (`(layer3)/profile/page.tsx:37` gọi lại
  // `getCurrentUserProfile()` ngay dưới layout đã gọi nó), nên nó được viết ra
  // thay vì trông chờ vào thói quen. Không `React.cache()`: kết luận "một lượt
  // đọc mỗi request" suy ra từ cách Next phân giải route group, không phải từ
  // memo hoá (entitlement.tsx:11-16).
  const entitlement = await readEntitlement(user?.id ?? null);

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <SiteHeader user={user} />
      <EntitlementProvider value={entitlement}>
        {/* id + tabIndex={-1}: đích nhảy của SkipLink (WCAG 2.4.1). tabIndex âm
            cho phép nhận tiêu điểm bằng lập trình mà không chen vào thứ tự Tab. */}
        {/* pb-bottom-nav: chừa chỗ cho BottomNav (fixed) để dòng cuối của trang
            không chui xuống dưới nó. Tự về 0 từ 768px vì thanh đáy không render. */}
        <div id="main-content" tabIndex={-1} className="pb-bottom-nav">
          {children}
        </div>
      </EntitlementProvider>
      <BottomNav />
      <SupportWidget user={user} />
    </div>
  );
}
