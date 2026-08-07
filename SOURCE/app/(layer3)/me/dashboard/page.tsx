// (layer3)/me/dashboard — /me/dashboard, the existing "Analytics" nav item's
// target (SiteHeader.tsx/HomeSidebar.tsx already point here; route groups are
// pathless, so no nav change was needed once this page exists — docs/design/
// analytics-layer3-design.md § Route & nav). Page-level auth guard mirrors
// (HM)/history/page.tsx / (layer4)/upload/page.tsx: guard runs strictly
// before any data fetch.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTranslate } from "@/lib/i18n/server";
import { getAnalyticsByRange } from "@/app/(layer3)/queries";
import { AnalyticsDashboard } from "@/app/(layer3)/_components/AnalyticsDashboard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function DashboardPage() {
  const t = await getTranslate();
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const dataByRange = await getAnalyticsByRange();

  return (
    // `full` (72rem) thay max-w-4xl cũ: đây là trang lưới dữ liệu — biểu đồ có
    // càng nhiều bề ngang thì các cột càng đọc được, và mép nội dung thẳng hàng
    // mép navbar (cùng 72rem).
    <PageContainer as="main" size="full">
      <PageHeader
        breadcrumbs={[{ label: t("nav.home"), href: "/" }, { label: t("nav.analytics") }]}
        title={t("analytics.title")}
        description={t("analytics.subtitle")}
      />

      <div className="mt-6">
        <AnalyticsDashboard dataByRange={dataByRange} />
      </div>
    </PageContainer>
  );
}
