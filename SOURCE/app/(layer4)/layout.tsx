// Layout route group (layer4) — khung chung cho MỌI trang Layer 4.
// Theme dùng thẳng root "Mực & Sơn mài" (globals.css) — không có scope riêng.
// SiteHeader dùng chung với Layer 2/3 (xem comment trong SiteHeader.tsx).

import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { SiteHeader } from "@/app/(layer2)/_components/SiteHeader";
import { SkipLink } from "@/components/shared/SkipLink";

export default async function Layer4Layout({ children }: { children: React.ReactNode }) {
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
