// AppShell — khung dùng chung cho MỌI route group đã đăng nhập (B1, 2026-09-03).
//
// Trước đây năm layout — (exams), (layer3), (layer4), (billing), (HM) — chép
// nhau TỪNG KÝ TỰ trừ tên hàm ((HM) thiếu EntitlementProvider). Một chỗ sửa
// thành năm chỗ sửa, và hai khối comment giải thích "vì sao" cũng bị nhân năm.
// Nay mỗi layout còn vài dòng gọi vào đây; phần "vì sao" sống ở một nơi.
//
// SiteHeader render Ở ĐÂY (1 lần cho mọi trang của route group) thay vì lặp lại
// trong từng page — tránh phải truyền `user` prop xuyên qua ExamPlayer (client
// component) và tránh fetch getCurrentUserProfile() nhiều lần mỗi navigation.
// Các trang con KHÔNG tự render <SiteHeader/> nữa, chỉ giữ `bg-background`
// (bỏ `min-h-dvh` — khung này gánh min-h-dvh, tránh cộng dồn chiều cao với
// header 56px gây scrollbar thừa, giống bug đã gặp ở M3.3 homepage).
//
// Theme dùng thẳng root "Mực & Sơn mài" (globals.css, S#17) — không còn scope
// .theme-l2 riêng; navbar đen sơn mài lấy từ biến --nav-* mặc định.

import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { readEntitlement } from "@/lib/billing/readEntitlement";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { SkipLink } from "@/components/shared/SkipLink";
import { SupportWidget } from "@/components/support/SupportWidget";

type AppShellProps = {
  children: React.ReactNode;
  /** `false` = KHÔNG đọc quyền lợi và KHÔNG mount EntitlementProvider. Chỉ
   *  (HM)/history dùng — xem comment ở layout đó. Mặc định `true`. */
  entitlement?: boolean;
};

/**
 * Gọi như một HÀM từ layout (`return AppShell({ children })`), không phải như
 * một phần tử JSX. Lý do là cơ học, không phải phong cách: hai test layout
 * (`app/(exams)/__tests__/layout.test.tsx`, `(layer4)`) render CÂY THẬT bằng
 * `render(await Layout({ children }))` trong jsdom, và bộ render client của
 * React 19 từ chối một phần tử async — nó suspend và cả cây ra rỗng. Layout
 * giữ dạng `export default async function` và trả thẳng kết quả của hàm này,
 * nên với mọi bộ render nó vẫn là "async function trả JSX" y như trước — kể cả
 * với `resolveServerTree()` của làn fixture, vốn nhận diện server component
 * bằng `type.constructor.name === "AsyncFunction"` (bỏ `async` là 46 ca đỏ).
 */
export async function AppShell({ children, entitlement = true }: AppShellProps) {
  const user = await getCurrentUserProfile();
  // Đọc quyền lợi ĐÚNG MỘT LẦN cho cả nhánh cây, rồi truyền xuống bằng context
  // — cùng cách root layout làm với locale. Nhờ vậy `useEntitlement()` ở mọi
  // component con là một lượt đọc context, không phải một round-trip (UI-D1).
  //
  // KỶ LUẬT ĐI KÈM, và nó ràng buộc mọi thứ nằm DƯỚI khung này: KHÔNG page hay
  // component nào bên dưới được gọi `readEntitlement()` — họ đọc context. Route
  // group là anh em chứ không lồng nhau, nên đúng một layout phân giải mỗi
  // request và đúng một lượt đọc được phát ra; một lượt gọi thứ hai không sai
  // về kết quả, chỉ là một round-trip thừa nằm sau mỗi lần render. Repo đã có
  // sẵn tiền lệ trôi đúng kiểu này (`(layer3)/profile/page.tsx:37` gọi lại
  // `getCurrentUserProfile()` ngay dưới layout đã gọi nó), nên nó được viết ra
  // thay vì trông chờ vào thói quen. Không `React.cache()` cho entitlement: kết
  // luận "một lượt đọc mỗi request" suy ra từ cách Next phân giải route group,
  // không phải từ memo hoá (entitlement.tsx:11-16).
  const entitlementValue = entitlement ? await readEntitlement(user?.id ?? null) : null;

  const main = (
    // id + tabIndex={-1}: đích nhảy của SkipLink (WCAG 2.4.1). tabIndex âm
    // cho phép nhận tiêu điểm bằng lập trình mà không chen vào thứ tự Tab.
    // pb-bottom-nav: chừa chỗ cho BottomNav (fixed) để dòng cuối của trang
    // không chui xuống dưới nó. Tự về 0 từ 768px vì thanh đáy không render.
    <div id="main-content" tabIndex={-1} className="pb-bottom-nav">
      {children}
    </div>
  );

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <SiteHeader user={user} />
      {entitlementValue ? (
        <EntitlementProvider value={entitlementValue}>{main}</EntitlementProvider>
      ) : (
        main
      )}
      <BottomNav signedIn={Boolean(user)} />
      <SupportWidget user={user} />
    </div>
  );
}
