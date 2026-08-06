// Layout route group (HM) — khung chung cho History (backend Design Doc
// history-backend-design.md v1.2, § Auth Guard and Layout). Structurally
// identical to (layer3)/(layer4) layout.tsx — nullable user, SiteHeader only,
// NO redirect (the guard lives in history/page.tsx instead, see AC-016).

import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { SiteHeader } from "@/app/(layer2)/_components/SiteHeader";
import { SkipLink } from "@/components/shared/SkipLink";

export default async function HMLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserProfile();

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <SiteHeader user={user} />
      {/* id + tabIndex={-1}: đích nhảy của SkipLink (WCAG 2.4.1). tabIndex âm
          cho phép nhận tiêu điểm bằng lập trình mà không chen vào thứ tự Tab. */}
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
