// Layout route group (layer3) — khung chung cho Analytics. Theme dùng thẳng
// root "Mực & Sơn mài" (globals.css), SiteHeader dùng chung với Layer 2/4
// (xem comment trong SiteHeader.tsx).

import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { readEntitlement } from "@/lib/billing/readEntitlement";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { SkipLink } from "@/components/shared/SkipLink";
import { SupportWidget } from "@/components/support/SupportWidget";

export default async function Layer3Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserProfile();

  // MỘT lượt đọc cho cả cây (layer3), giống hệt (layer2)/(layer4)/(billing):
  // component bên dưới KHÔNG gọi lại `readEntitlement()`, họ đọc context.
  //
  // VÌ SAO (layer3) CẦN NÓ, dù trước đây không: /profile nay có tab Usage
  // render `PlanSummary` (C-11), và `useEntitlement()` NGOÀI provider trả
  // `FREE_FALLBACK` — tức một người Premium sẽ thấy hạn mức của gói Free,
  // im lặng, không lỗi, không log. Đó đúng là kiểu hỏng mà
  // `TutorQuotaNote` đã phải ghi cả một khối chú thích để cảnh báo.
  const entitlement = await readEntitlement(user?.id ?? null);

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <SiteHeader user={user} />
      {/* id + tabIndex={-1}: đích nhảy của SkipLink (WCAG 2.4.1). tabIndex âm
          cho phép nhận tiêu điểm bằng lập trình mà không chen vào thứ tự Tab. */}
      {/* pb-bottom-nav: chừa chỗ cho BottomNav (fixed) để dòng cuối của trang
          không chui xuống dưới nó. Tự về 0 từ 768px vì thanh đáy không render. */}
      <EntitlementProvider value={entitlement}>
        <div id="main-content" tabIndex={-1} className="pb-bottom-nav">
          {children}
        </div>
      </EntitlementProvider>
      <BottomNav signedIn={Boolean(user)} />
      <SupportWidget user={user} />
    </div>
  );
}
