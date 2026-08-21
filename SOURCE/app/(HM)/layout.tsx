// Layout route group (HM) — khung chung cho History (backend Design Doc
// history-backend-design.md v1.2, § Auth Guard and Layout). Structurally
// identical to (layer3)/(layer4) layout.tsx — nullable user, SiteHeader only,
// NO redirect (the guard lives in history/page.tsx instead, see AC-016).

import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { SkipLink } from "@/components/shared/SkipLink";
import { SupportWidget } from "@/components/support/SupportWidget";

export default async function HMLayout({ children }: { children: React.ReactNode }) {
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
