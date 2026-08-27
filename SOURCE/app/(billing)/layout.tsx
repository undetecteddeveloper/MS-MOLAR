// Layout route group (billing) — UI Spec UI-D7.
//
// Khung giống hệt (layer2)/layout.tsx, cộng thêm EntitlementProvider. Ba route
// nằm dưới đây: /pricing (cần đăng nhập) và /terms, /refund-policy (CÔNG KHAI).
//
// Một group chứa cả trang cần đăng nhập lẫn trang công khai là hợp lệ và không
// cần xử lý gì đặc biệt: quyền truy cập do middleware quyết theo TỪNG PATH
// (lib/supabase/middleware.ts PUBLIC_PATHS), không theo route group. Còn khung
// này vốn đã an toàn với khách chưa đăng nhập — getCurrentUserProfile() trả
// null khi không có phiên, SiteHeader đã mặc định `user = null`, và app/page.tsx
// (trang công khai duy nhất hiện có) đang render đúng tổ hợp này cho khách mỗi
// ngày. Không có gì mới bị mạo hiểm ở đây.

import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { readEntitlement } from "@/lib/billing/readEntitlement";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { SkipLink } from "@/components/shared/SkipLink";
import { SupportWidget } from "@/components/support/SupportWidget";

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserProfile();
  // Đọc quyền lợi ĐÚNG MỘT LẦN cho cả nhánh cây, rồi truyền xuống bằng context
  // — cùng cách root layout làm với locale. Nhờ vậy `useEntitlement()` ở mọi
  // component con là một lượt đọc context, không phải một round-trip (UI-D1).
  const entitlement = await readEntitlement(user?.id ?? null);

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <SiteHeader user={user} />
      <EntitlementProvider value={entitlement}>
        {/* id + tabIndex={-1}: đích nhảy của SkipLink (WCAG 2.4.1).
            pb-bottom-nav: chừa chỗ cho BottomNav (fixed), tự về 0 từ 768px. */}
        <div id="main-content" tabIndex={-1} className="pb-bottom-nav">
          {children}
        </div>
      </EntitlementProvider>
      <BottomNav signedIn={Boolean(user)} />
      <SupportWidget user={user} />
    </div>
  );
}
