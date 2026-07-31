// Layout route group (layer3) — khung chung cho Analytics. Theme dùng thẳng
// root "Mực & Sơn mài" (globals.css), SiteHeader dùng chung với Layer 2/4
// (xem comment trong SiteHeader.tsx).

import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { SiteHeader } from "@/app/(layer2)/_components/SiteHeader";

export default async function Layer3Layout({
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
