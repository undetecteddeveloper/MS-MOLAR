// (layer3)/me/dashboard — /me/dashboard, the existing "Analytics" nav item's
// target (SiteHeader.tsx/HomeSidebar.tsx already point here; route groups are
// pathless, so no nav change was needed once this page exists — docs/design/
// analytics-layer3-design.md § Route & nav). Page-level auth guard mirrors
// (HM)/history/page.tsx / (layer4)/upload/page.tsx: guard runs strictly
// before any data fetch.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAnalyticsByRange } from "@/app/(layer3)/queries";
import { AnalyticsDashboard } from "@/app/(layer3)/_components/AnalyticsDashboard";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const dataByRange = await getAnalyticsByRange();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="font-serif text-2xl text-foreground">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Track correct/incorrect answers by subject and practice frequency.
      </p>

      <div className="mt-6">
        <AnalyticsDashboard dataByRange={dataByRange} />
      </div>
    </main>
  );
}
