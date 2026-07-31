// Layout route group (HM) — khung chung cho History (backend Design Doc
// history-backend-design.md v1.2, § Auth Guard and Layout). Structurally
// identical to (layer3)/(layer4) layout.tsx — nullable user, SiteHeader only,
// NO redirect (the guard lives in history/page.tsx instead, see AC-016).

import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { SiteHeader } from "@/app/(layer2)/_components/SiteHeader";

export default async function HMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserProfile();

  return (
    <div className="min-h-dvh">
      <SiteHeader user={user} />
      {children}
    </div>
  );
}
